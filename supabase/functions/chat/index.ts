import {
  completionWrite,
  composeRange,
  interpretTool,
  isDateKey,
  sameStoredTask,
  storedTaskFromRow,
  toolDefinitions,
  type StoredTask,
  type TaskDraft,
  type TaskPatch,
  type ToolDecision,
} from "./interpret.ts";

const TASK_COLUMNS = "id,title,date_key,due_time,done,priority,context,recurrence,ignored_on";
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ToolMark = "" | "ok" | "error" | "question";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return json(405, { error: "unavailable" });
  }
  try {
    return await handle(request);
  } catch {
    return json(502, { error: "unavailable" });
  }
});

async function handle(request: Request): Promise<Response> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const auth = request.headers.get("Authorization") ?? "";
  if (!url.startsWith("https://") || !anon || !auth.startsWith("Bearer ") || !openAiKey || bearerRole(auth) === "service_role") {
    return json(503, { error: "unavailable" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "unavailable" });
  }
  const input = record(body);
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const todayKey = typeof input.todayKey === "string" ? input.todayKey : "";
  const timeZone = typeof input.timeZone === "string" && input.timeZone.trim().length <= 80 ? input.timeZone.trim() : "Europe/Paris";
  if (message.length < 1 || message.length > 400 || !isDateKey(todayKey)) {
    return json(400, { error: "unavailable" });
  }

  const userId = await readUserId(url, anon, auth);
  if (!userId) {
    return json(401, { error: "unavailable" });
  }

  const tasks = await listTasks(url, anon, auth, userId);
  const history = await listRecentMessages(url, anon, auth, userId);
  const messages: unknown[] = [
    { role: "system", content: systemPrompt(todayKey, timeZone, tasks) },
    ...history,
    { role: "user", content: message },
  ];

  let tasksChanged = false;
  let coachChanged = false;
  let mark: ToolMark = "";
  for (let round = 0; round < 4; round += 1) {
    const model = await complete(openAiKey, messages);
    if (!model) {
      return json(502, { error: "unavailable" });
    }
    const calls = Array.isArray(model.tool_calls) ? model.tool_calls : [];
    if (calls.length === 0) {
      const text = typeof model.content === "string" ? model.content.trim() : "";
      return finish(url, anon, auth, userId, message, text || "Je n’ai pas pu formuler de réponse.", tasksChanged, coachChanged, mark);
    }
    messages.push({ role: "assistant", content: model.content ?? "", tool_calls: calls });
    for (const call of calls.slice(0, 4)) {
      const outcome = await runTool(url, anon, auth, userId, todayKey, call);
      tasksChanged = tasksChanged || outcome.tasksChanged;
      coachChanged = coachChanged || outcome.coachChanged;
      mark = mergeMark(mark, outcome.mark);
      messages.push({ role: "tool", tool_call_id: call.id ?? "missing", content: JSON.stringify(outcome.payload) });
    }
    for (const call of calls.slice(4)) {
      mark = mergeMark(mark, "error");
      messages.push({
        role: "tool",
        tool_call_id: call.id ?? "missing",
        content: JSON.stringify({ ok: false, error: "Trop d’actions d’un coup." }),
      });
    }
  }
  return finish(url, anon, auth, userId, message, "Je n’ai pas terminé. Peux-tu préciser ?", tasksChanged, coachChanged, mark);
}

async function finish(
  url: string,
  anon: string,
  auth: string,
  userId: string,
  message: string,
  reply: string,
  tasksChanged: boolean,
  coachChanged: boolean,
  mark: ToolMark,
): Promise<Response> {
  const text = reply.trim().slice(0, 4000) || "Je n’ai pas pu formuler de réponse.";
  const historySaved = await saveExchange(url, anon, auth, userId, message, text, mark);
  return json(200, { reply: text, tasksChanged, coachChanged, historySaved });
}

async function runTool(
  url: string,
  anon: string,
  auth: string,
  userId: string,
  todayKey: string,
  call: { id?: string; function?: { name?: string; arguments?: string } },
): Promise<{ payload: unknown; tasksChanged: boolean; coachChanged: boolean; mark: ToolMark }> {
  const name = call.function?.name ?? "";
  const args = parseArgs(call.function?.arguments);
  const decision = interpretTool(name, args, todayKey);
  if (decision.kind === "question") {
    return { payload: { ok: false, question: decision.question }, tasksChanged: false, coachChanged: false, mark: "question" };
  }
  if (decision.kind === "unavailable") {
    return { payload: { ok: false, error: decision.message }, tasksChanged: false, coachChanged: false, mark: "error" };
  }
  if (decision.kind === "create_task") {
    const saved = await insertTask(url, anon, auth, userId, decision.task);
    return saved
      ? { payload: { ok: true, saved: true, id: saved.id, title: saved.title }, tasksChanged: true, coachChanged: false, mark: "ok" }
      : { payload: { ok: false, error: "La base n’a pas enregistré la ligne." }, tasksChanged: false, coachChanged: false, mark: "error" };
  }
  if (decision.kind === "update_task" || decision.kind === "complete_task") {
    const current = await readTask(url, anon, auth, userId, decision.id);
    if (current === "failed") {
      return { payload: { ok: false, error: "La base n’a pas enregistré la ligne." }, tasksChanged: false, coachChanged: false, mark: "error" };
    }
    if (!current) {
      return { payload: { ok: false, error: "Cette tâche est introuvable." }, tasksChanged: false, coachChanged: false, mark: "error" };
    }
    const saved =
      decision.kind === "complete_task"
        ? await writeCompletion(url, anon, auth, userId, current)
        : await writePatch(url, anon, auth, userId, current, decision.patch);
    return saved
      ? { payload: { ok: true, saved: true, id: saved.id, title: saved.title }, tasksChanged: true, coachChanged: false, mark: "ok" }
      : { payload: { ok: false, error: "La base n’a pas enregistré la ligne." }, tasksChanged: false, coachChanged: false, mark: "error" };
  }
  if (decision.kind === "delete_task") {
    const removed = await deleteTask(url, anon, auth, userId, decision.id);
    return removed
      ? { payload: { ok: true, saved: true, id: decision.id }, tasksChanged: true, coachChanged: false, mark: "ok" }
      : { payload: { ok: false, error: "La base n’a pas enregistré la ligne." }, tasksChanged: false, coachChanged: false, mark: "error" };
  }
  if (decision.kind === "read_schedule" || decision.kind === "read_pending" || decision.kind === "compose") {
    const listed = await listTasks(url, anon, auth, userId);
    if (!listed) {
      return { payload: { ok: false, error: "Les tâches n’ont pas pu être lues." }, tasksChanged: false, coachChanged: false, mark: "error" };
    }
    const range = decision.kind === "compose" ? composeRange(decision.scope, decision.dateKey) : null;
    const selected =
      decision.kind === "read_pending"
        ? listed.filter((task) => !task.done).slice(0, 40)
        : listed
            .filter((task) => {
              const dateKey = decision.kind === "read_schedule" ? decision.dateKey : range?.from;
              const end = decision.kind === "read_schedule" ? decision.dateKey : range?.to;
              return dateKey !== undefined && end !== undefined && task.dateKey >= dateKey && task.dateKey <= end;
            })
            .slice(0, 40);
    return { payload: { ok: true, saved: false, tasks: selected.map(publicTask) }, tasksChanged: false, coachChanged: false, mark: "ok" };
  }
  if (decision.kind === "create_routine" || decision.kind === "create_goal" || decision.kind === "update_goal") {
    const saved = await writeCoach(url, anon, auth, userId, decision);
    return saved.ok
      ? { payload: { ok: true, saved: true, id: saved.id, title: saved.title }, tasksChanged: false, coachChanged: true, mark: "ok" }
      : { payload: { ok: false, error: saved.error }, tasksChanged: false, coachChanged: false, mark: "error" };
  }
  if (decision.kind === "search_memory") {
    const found = await searchMemories(url, anon, auth, userId, decision.query);
    return found
      ? { payload: { ok: true, saved: false, memories: found }, tasksChanged: false, coachChanged: false, mark: "ok" }
      : { payload: { ok: false, error: "Les souvenirs n’ont pas pu être lus." }, tasksChanged: false, coachChanged: false, mark: "error" };
  }
  const saved = await insertMemory(url, anon, auth, userId, decision);
  return saved
    ? { payload: { ok: true, saved: true, id: saved.id }, tasksChanged: false, coachChanged: false, mark: "ok" }
    : { payload: { ok: false, error: "La base n’a pas enregistré la ligne." }, tasksChanged: false, coachChanged: false, mark: "error" };
}

function systemPrompt(todayKey: string, timeZone: string, tasks: StoredTask[] | null): string {
  const lines = tasks ? tasks.slice(0, 40).map(publicTask) : null;
  return [
    "Tu es Jarvis. Tu réponds en français, en phrases courtes.",
    `Aujourd’hui est ${todayKey}, fuseau ${timeZone}.`,
    lines ? `Tâches connues : ${JSON.stringify(lines)}` : "Les tâches n’ont pas pu être lues.",
    "Utilise les outils pour lire ou écrire. N’invente pas une tâche.",
    "Si un outil renvoie une question, pose-la et n’écris rien.",
    "Confirme une action seulement quand le résultat contient saved true.",
    "Si saved est absent ou faux, dis que ce n’est pas enregistré.",
    "Une routine ou un objectif n’est confirmé que si saved est true.",
    "Un plan ou un bilan proposé dans la réponse n’est pas enregistré.",
  ].join("\n");
}

async function complete(openAiKey: string, messages: unknown[]): Promise<{ content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: { authorization: `Bearer ${openAiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 600,
        messages,
        tools: toolDefinitions(),
      }),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } }[] };
    return body.choices?.[0]?.message ?? null;
  } catch {
    return null;
  }
}

async function readUserId(url: string, anon: string, auth: string): Promise<string | null> {
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, authorization: auth } });
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as { id?: unknown };
  return typeof body.id === "string" && USER_ID.test(body.id) ? body.id : null;
}

async function listTasks(url: string, anon: string, auth: string, userId: string): Promise<StoredTask[] | null> {
  const result = await rest(url, anon, auth, `tasks?select=${TASK_COLUMNS}&user_id=eq.${userId}&order=date_key.asc,due_time.asc&limit=200`);
  if (!result.ok || !Array.isArray(result.body)) {
    return null;
  }
  return result.body.flatMap((row) => {
    const task = storedTaskFromRow(row);
    return task ? [task] : [];
  });
}

async function readTask(url: string, anon: string, auth: string, userId: string, id: string): Promise<StoredTask | null | "failed"> {
  const result = await rest(url, anon, auth, `tasks?select=${TASK_COLUMNS}&id=eq.${id}&user_id=eq.${userId}&limit=1`);
  if (!result.ok || !Array.isArray(result.body)) {
    return "failed";
  }
  if (result.body.length === 0) {
    return null;
  }
  return storedTaskFromRow(result.body[0]) ?? "failed";
}

async function insertTask(url: string, anon: string, auth: string, userId: string, draft: TaskDraft): Promise<StoredTask | null> {
  const id = crypto.randomUUID();
  const expected: StoredTask = { ...draft, id, done: false, ignoredOn: null };
  const result = await rest(url, anon, auth, "tasks", {
    method: "POST",
    body: JSON.stringify({
      id,
      user_id: userId,
      title: draft.title,
      date_key: draft.dateKey,
      due_time: draft.dueTime,
      done: false,
      priority: draft.priority,
      context: draft.context,
      recurrence: draft.recurrence,
      ignored_on: null,
    }),
  });
  const saved = oneTask(result);
  return saved && sameStoredTask(saved, expected) ? saved : null;
}

async function writePatch(url: string, anon: string, auth: string, userId: string, current: StoredTask, patch: TaskPatch): Promise<StoredTask | null> {
  const expected: StoredTask = {
    ...current,
    title: patch.title ?? current.title,
    dateKey: patch.dateKey ?? current.dateKey,
    dueTime: patch.dueTime === undefined ? current.dueTime : patch.dueTime,
    priority: patch.priority ?? current.priority,
    context: patch.context ?? current.context,
    recurrence: patch.recurrence ?? current.recurrence,
  };
  return writeTask(url, anon, auth, userId, expected);
}

async function writeCompletion(url: string, anon: string, auth: string, userId: string, current: StoredTask): Promise<StoredTask | null> {
  const next = completionWrite(current);
  return writeTask(url, anon, auth, userId, { ...current, ...next });
}

async function writeTask(url: string, anon: string, auth: string, userId: string, expected: StoredTask): Promise<StoredTask | null> {
  const result = await rest(url, anon, auth, `tasks?id=eq.${expected.id}&user_id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: expected.title,
      date_key: expected.dateKey,
      due_time: expected.dueTime,
      done: expected.done,
      priority: expected.priority,
      context: expected.context,
      recurrence: expected.recurrence,
      ignored_on: expected.ignoredOn,
    }),
  });
  const saved = oneTask(result);
  return saved && sameStoredTask(saved, expected) ? saved : null;
}

async function deleteTask(url: string, anon: string, auth: string, userId: string, id: string): Promise<boolean> {
  const result = await rest(url, anon, auth, `tasks?id=eq.${id}&user_id=eq.${userId}`, { method: "DELETE" });
  return oneTask(result)?.id === id;
}

async function writeCoach(
  url: string,
  anon: string,
  auth: string,
  userId: string,
  decision: Extract<ToolDecision, { kind: "create_routine" | "create_goal" | "update_goal" }>,
): Promise<{ ok: true; id: string; title: string } | { ok: false; error: string }> {
  if (decision.kind === "create_routine") {
    return insertRoutine(url, anon, auth, userId, decision);
  }
  if (decision.kind === "create_goal") {
    return insertGoal(url, anon, auth, userId, decision.title, decision.domain);
  }
  return updateGoal(url, anon, auth, userId, decision);
}

async function insertRoutine(
  url: string,
  anon: string,
  auth: string,
  userId: string,
  draft: { title: string; dueTime: string | null; recurrence: string; steps: string[] },
): Promise<{ ok: true; id: string; title: string } | { ok: false; error: string }> {
  const id = crypto.randomUUID();
  const created = await rest(url, anon, auth, "routines", {
    method: "POST",
    body: JSON.stringify({ id, user_id: userId, title: draft.title, due_time: draft.dueTime, recurrence: draft.recurrence }),
  });
  const row = oneRecord(created);
  if (row.id !== id || row.title !== draft.title || row.recurrence !== draft.recurrence || !sameClock(row.due_time, draft.dueTime)) {
    return { ok: false, error: "La base n’a pas enregistré la ligne." };
  }
  const steps = draft.steps.map((title, index) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    routine_id: id,
    position: index + 1,
    title,
    done_on: null,
  }));
  const inserted = await rest(url, anon, auth, "routine_steps", { method: "POST", body: JSON.stringify(steps) });
  const rows = inserted.ok && Array.isArray(inserted.body) ? inserted.body : [];
  const matched =
    rows.length === steps.length &&
    steps.every((step) =>
      rows.some((item) => {
        const saved = record(item);
        return saved.id === step.id && saved.title === step.title && Number(saved.position) === step.position;
      }),
    );
  if (!matched) {
    await rest(url, anon, auth, `routines?id=eq.${id}&user_id=eq.${userId}`, { method: "DELETE" });
    return { ok: false, error: "La base n’a pas enregistré la ligne." };
  }
  return { ok: true, id, title: draft.title };
}

async function insertGoal(
  url: string,
  anon: string,
  auth: string,
  userId: string,
  title: string,
  domain: string,
): Promise<{ ok: true; id: string; title: string } | { ok: false; error: string }> {
  const id = crypto.randomUUID();
  const result = await rest(url, anon, auth, "goals", {
    method: "POST",
    body: JSON.stringify({ id, user_id: userId, title, domain }),
  });
  const row = oneRecord(result);
  return row.id === id && row.title === title && row.domain === domain
    ? { ok: true, id, title }
    : { ok: false, error: "La base n’a pas enregistré la ligne." };
}

async function updateGoal(
  url: string,
  anon: string,
  auth: string,
  userId: string,
  patch: { id: string; title?: string; domain?: string },
): Promise<{ ok: true; id: string; title: string } | { ok: false; error: string }> {
  const current = await rest(url, anon, auth, `goals?select=id,title,domain&id=eq.${patch.id}&user_id=eq.${userId}&limit=1`);
  if (!current.ok || !Array.isArray(current.body)) {
    return { ok: false, error: "La base n’a pas enregistré la ligne." };
  }
  if (current.body.length === 0) {
    return { ok: false, error: "Cet objectif est introuvable." };
  }
  const row = record(current.body[0]);
  const title = patch.title ?? (typeof row.title === "string" ? row.title : "");
  const domain = patch.domain ?? (typeof row.domain === "string" ? row.domain : "");
  const result = await rest(url, anon, auth, `goals?id=eq.${patch.id}&user_id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ title, domain }),
  });
  const saved = oneRecord(result);
  return saved.id === patch.id && saved.title === title && saved.domain === domain
    ? { ok: true, id: patch.id, title }
    : { ok: false, error: "La base n’a pas enregistré la ligne." };
}

function oneRecord(result: { ok: boolean; body: unknown }): Record<string, unknown> {
  if (!result.ok || !Array.isArray(result.body)) {
    return {};
  }
  return record(result.body[0]);
}

function sameClock(stored: unknown, expected: string | null): boolean {
  if (expected === null) {
    return stored == null;
  }
  return typeof stored === "string" && stored.slice(0, 5) === expected;
}

async function insertMemory(
  url: string,
  anon: string,
  auth: string,
  userId: string,
  memory: { content: string; category: string; sensitive: boolean; origin: string },
): Promise<{ id: string } | null> {
  const id = crypto.randomUUID();
  const result = await rest(url, anon, auth, "memories", {
    method: "POST",
    body: JSON.stringify({ id, user_id: userId, content: memory.content, category: memory.category, sensitive: memory.sensitive, origin: memory.origin }),
  });
  if (!result.ok || !Array.isArray(result.body)) {
    return null;
  }
  const row = record(result.body[0]);
  return row.id === id && row.content === memory.content && row.category === memory.category && row.sensitive === memory.sensitive && row.origin === memory.origin
    ? { id }
    : null;
}

async function searchMemories(url: string, anon: string, auth: string, userId: string, query: string): Promise<{ id: string; content: string; category: string }[] | null> {
  const result = await rest(url, anon, auth, `memories?select=id,content,category&user_id=eq.${userId}&limit=50`);
  if (!result.ok || !Array.isArray(result.body)) {
    return null;
  }
  const needle = query.toLowerCase();
  return result.body.flatMap((item) => {
    const row = record(item);
    if (typeof row.id !== "string" || typeof row.content !== "string" || typeof row.category !== "string") {
      return [];
    }
    return row.content.toLowerCase().includes(needle) ? [{ id: row.id, content: row.content, category: row.category }] : [];
  }).slice(0, 8);
}

async function listRecentMessages(url: string, anon: string, auth: string, userId: string): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const result = await rest(url, anon, auth, `messages?select=role,content&user_id=eq.${userId}&order=created_at.desc&limit=10`);
  if (!result.ok || !Array.isArray(result.body)) {
    return [];
  }
  return result.body
    .flatMap((item) => {
      const row = record(item);
      if ((row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") {
        return [];
      }
      return [{ role: row.role, content: row.content.slice(0, 500) }];
    })
    .reverse();
}

async function saveExchange(url: string, anon: string, auth: string, userId: string, message: string, reply: string, mark: ToolMark): Promise<boolean> {
  const existing = await rest(url, anon, auth, `conversations?select=id&user_id=eq.${userId}&order=updated_at.desc&limit=1`);
  let conversationId = existing.ok && Array.isArray(existing.body) ? stringId(record(existing.body[0]).id) : null;
  if (!conversationId) {
    const created = await rest(url, anon, auth, "conversations", { method: "POST", body: JSON.stringify({ user_id: userId }) });
    conversationId = created.ok && Array.isArray(created.body) ? stringId(record(created.body[0]).id) : null;
  }
  if (!conversationId) {
    return false;
  }
  const now = Date.now();
  const inserted = await rest(url, anon, auth, "messages", {
    method: "POST",
    body: JSON.stringify([
      { user_id: userId, conversation_id: conversationId, role: "user", content: message, tool_result: "", created_at: new Date(now).toISOString() },
      { user_id: userId, conversation_id: conversationId, role: "assistant", content: reply, tool_result: mark, created_at: new Date(now + 1).toISOString() },
    ]),
  });
  if (!inserted.ok || !Array.isArray(inserted.body) || inserted.body.length !== 2) {
    return false;
  }
  await rest(url, anon, auth, `conversations?id=eq.${conversationId}&user_id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
  return true;
}

async function rest(url: string, anon: string, auth: string, path: string, init: RequestInit = {}): Promise<{ ok: boolean; body: unknown }> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anon,
      authorization: auth,
      accept: "application/json",
      "content-type": "application/json",
      prefer: "return=representation",
    },
  });
  const text = await response.text();
  if (!text) {
    return { ok: response.ok, body: null };
  }
  try {
    return { ok: response.ok, body: JSON.parse(text) };
  } catch {
    return { ok: false, body: null };
  }
}

function oneTask(result: { ok: boolean; body: unknown }): StoredTask | null {
  if (!result.ok || !Array.isArray(result.body)) {
    return null;
  }
  return storedTaskFromRow(result.body[0]);
}

function publicTask(task: StoredTask) {
  return {
    id: task.id,
    title: task.title,
    date: task.dateKey,
    time: task.dueTime,
    done: task.done,
    priority: task.priority,
  };
}

function parseArgs(value: string | undefined): unknown {
  if (!value || value.length > 4000) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function mergeMark(current: ToolMark, next: ToolMark): ToolMark {
  if (current === "error" || next === "error") {
    return "error";
  }
  if (current === "question" || next === "question") {
    return "question";
  }
  return next === "ok" || current === "ok" ? "ok" : "";
}

function bearerRole(auth: string): string | null {
  const payload = auth.slice("Bearer ".length).split(".")[1];
  if (!payload) {
    return null;
  }
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: unknown };
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return "unreadable";
  }
}

function stringId(value: unknown): string | null {
  return typeof value === "string" && USER_ID.test(value) ? value : null;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "content-type": "application/json" } });
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  };
}
