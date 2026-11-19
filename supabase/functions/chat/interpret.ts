const TITLE_LIMIT = 80;
const RECURRENCES = ["none", "daily", "weekly", "weekdays"] as const;
type Recurrence = (typeof RECURRENCES)[number];
const AI_TOOL_NAMES = [
  "create_task",
  "update_task",
  "delete_task",
  "create_reminder",
  "create_recurring_reminder",
  "reschedule_task",
  "complete_task",
  "create_routine",
  "create_goal",
  "update_goal",
  "get_daily_schedule",
  "get_pending_tasks",
  "search_memory",
  "save_memory",
  "generate_daily_plan",
  "generate_weekly_review",
] as const;
type AiToolName = (typeof AI_TOOL_NAMES)[number];

const TASK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new Error("Date invalide");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error("Date invalide");
  }
  return { year, month, day };
}

function addDays(dateKey: string, amount: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  const nextYear = shifted.getUTCFullYear();
  const nextMonth = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(shifted.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function weekdayIndexMonday(dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

function parseClock(value: string): string | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return `${match[1]}:${match[2]}`;
}

function isRecurrence(value: string): value is Recurrence {
  return (RECURRENCES as readonly string[]).includes(value);
}

function nextOccurrence(dateKey: string, recurrence: Recurrence): string {
  if (recurrence === "weekly") {
    return addDays(dateKey, 7);
  }
  if (recurrence === "weekdays") {
    let cursor = addDays(dateKey, 1);
    while (weekdayIndexMonday(cursor) >= 5) {
      cursor = addDays(cursor, 1);
    }
    return cursor;
  }
  return addDays(dateKey, 1);
}

export const MEMORY_CATEGORIES = ["preference", "fact", "person", "health", "finance", "private"] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

const SENSITIVE: readonly MemoryCategory[] = ["health", "finance", "private"];

export type TaskDraft = {
  title: string;
  dateKey: string;
  dueTime: string | null;
  priority: boolean;
  context: string;
  recurrence: Recurrence;
};

export type TaskPatch = {
  title?: string;
  dateKey?: string;
  dueTime?: string | null;
  priority?: boolean;
  context?: string;
  recurrence?: Recurrence;
};

export type StoredTask = TaskDraft & {
  id: string;
  done: boolean;
  ignoredOn: string | null;
};

export type ToolDecision =
  | { kind: "question"; question: string }
  | { kind: "unavailable"; message: string }
  | { kind: "create_task"; task: TaskDraft }
  | { kind: "update_task"; id: string; patch: TaskPatch }
  | { kind: "delete_task"; id: string }
  | { kind: "complete_task"; id: string }
  | { kind: "read_schedule"; dateKey: string }
  | { kind: "read_pending" }
  | { kind: "save_memory"; content: string; category: MemoryCategory; sensitive: boolean; origin: "user" | "confirmed_suggestion" }
  | { kind: "search_memory"; query: string }
  | { kind: "compose"; scope: "day" | "week"; dateKey: string }
  | { kind: "create_routine"; title: string; dueTime: string | null; recurrence: "none" | "daily" | "weekdays"; steps: string[] }
  | { kind: "create_goal"; title: string; domain: string }
  | { kind: "update_goal"; id: string; title?: string; domain?: string };

const UNAVAILABLE = "Cette action n’est pas encore disponible.";
const UNKNOWN = "Cet outil n’existe pas.";

export function interpretTool(name: string, args: unknown, todayKey: string): ToolDecision {
  if (!isToolName(name)) {
    return { kind: "unavailable", message: UNKNOWN };
  }
  const input = record(args);
  if (name === "create_routine" || name === "create_goal" || name === "update_goal") {
    return interpretCoach(name, input);
  }
  if (name === "create_task" || name === "create_reminder" || name === "create_recurring_reminder") {
    return interpretCreate(name, input, todayKey);
  }
  if (name === "update_task" || name === "reschedule_task") {
    return interpretUpdate(name, input, todayKey);
  }
  if (name === "delete_task" || name === "complete_task") {
    const id = taskId(input);
    if (!id) {
      return { kind: "question", question: "Quelle tâche ?" };
    }
    return name === "delete_task" ? { kind: "delete_task", id } : { kind: "complete_task", id };
  }
  if (name === "get_pending_tasks") {
    return { kind: "read_pending" };
  }
  if (name === "get_daily_schedule" || name === "generate_daily_plan" || name === "generate_weekly_review") {
    const provided = explicitDate(input, todayKey);
    const dateKey = provided === "missing" ? validDate(todayKey) : provided;
    if (!dateKey) {
      return { kind: "question", question: "Quel jour ?" };
    }
    if (name === "get_daily_schedule") {
      return { kind: "read_schedule", dateKey };
    }
    return { kind: "compose", scope: name === "generate_daily_plan" ? "day" : "week", dateKey };
  }
  if (name === "search_memory") {
    return interpretSearch(input);
  }
  return interpretMemory(input);
}

export function completionWrite(task: StoredTask): Pick<StoredTask, "done" | "dateKey" | "ignoredOn"> {
  if (task.recurrence === "none") {
    return { done: true, dateKey: task.dateKey, ignoredOn: task.ignoredOn };
  }
  return { done: false, dateKey: nextOccurrence(task.dateKey, task.recurrence), ignoredOn: null };
}

export function sameStoredTask(left: StoredTask, right: StoredTask): boolean {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.dateKey === right.dateKey &&
    left.dueTime === right.dueTime &&
    left.done === right.done &&
    left.priority === right.priority &&
    left.context === right.context &&
    left.recurrence === right.recurrence &&
    left.ignoredOn === right.ignoredOn
  );
}

export function storedTaskFromRow(value: unknown): StoredTask | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !TASK_ID.test(row.id) || typeof row.title !== "string") {
    return null;
  }
  const title = row.title.trim();
  const dateKey = typeof row.date_key === "string" ? validDate(row.date_key) : null;
  if (title.length < 1 || title.length > TITLE_LIMIT || !dateKey) {
    return null;
  }
  const dueTime = clockOf(row.due_time);
  if (dueTime === "invalid" || typeof row.done !== "boolean" || typeof row.priority !== "boolean") {
    return null;
  }
  if (typeof row.context !== "string" || row.context.length > 80 || typeof row.recurrence !== "string" || !isRecurrence(row.recurrence)) {
    return null;
  }
  const ignoredOn = row.ignored_on == null ? null : typeof row.ignored_on === "string" ? validDate(row.ignored_on) : null;
  if (row.ignored_on != null && !ignoredOn) {
    return null;
  }
  return {
    id: row.id,
    title,
    dateKey,
    dueTime,
    done: row.done,
    priority: row.priority,
    context: row.context,
    recurrence: row.recurrence,
    ignoredOn,
  };
}

export function composeRange(scope: "day" | "week", dateKey: string): { from: string; to: string } {
  if (scope === "day") {
    return { from: dateKey, to: dateKey };
  }
  return { from: dateKey, to: addDays(dateKey, 6) };
}

export function toolDefinitions(): { type: "function"; function: { name: AiToolName; description: string; parameters: { type: "object"; properties: Record<string, unknown> } } }[] {
  const day = { type: "string", description: "Jour AAAA-MM-JJ, aujourd’hui, demain ou hier." };
  const time = { type: "string", description: "Heure HH:mm. Omettre si elle est inconnue." };
  const taskIdProperty = { type: "string", description: "Identifiant de la tâche." };
  return [
    spec("create_task", "Crée une tâche. Demande le titre ou le jour s’il manque.", { title: { type: "string" }, date: day, time, priority: { type: "boolean" }, context: { type: "string" }, recurrence: { type: "string" } }),
    spec("update_task", "Modifie une tâche existante. Demande ce qui change si rien n’est précisé.", { id: taskIdProperty, title: { type: "string" }, date: day, time, priority: { type: "boolean" }, context: { type: "string" }, recurrence: { type: "string" } }),
    spec("delete_task", "Supprime une tâche.", { id: taskIdProperty }),
    spec("create_reminder", "Crée une tâche avec une heure. Demande l’heure si elle manque.", { title: { type: "string" }, date: day, time, priority: { type: "boolean" }, context: { type: "string" } }),
    spec("create_recurring_reminder", "Crée un rappel répété. Demande l’heure et la répétition si elles manquent.", { title: { type: "string" }, date: day, time, recurrence: { type: "string" } }),
    spec("reschedule_task", "Déplace une tâche vers un autre jour ou une autre heure.", { id: taskIdProperty, date: day, time }),
    spec("complete_task", "Marque une tâche terminée. Une répétition avance à l’occurrence suivante.", { id: taskIdProperty }),
    spec("create_routine", "Crée une routine. Demande le titre ou les étapes s’ils manquent. N’invente pas d’étapes.", { title: { type: "string" }, steps: { type: "array", items: { type: "string" } }, time, recurrence: { type: "string", description: "none, daily ou weekdays." } }),
    spec("create_goal", "Crée un objectif. Demande le titre ou le domaine s’il manque.", { title: { type: "string" }, domain: { type: "string", description: "personnel, habitudes, famille, couple, santé, travail ou loisirs." } }),
    spec("update_goal", "Modifie le titre ou le domaine d’un objectif existant.", { id: { type: "string" }, title: { type: "string" }, domain: { type: "string" } }),
    spec("get_daily_schedule", "Lit les tâches d’un jour.", { date: day }),
    spec("get_pending_tasks", "Lit les tâches ouvertes.", {}),
    spec("search_memory", "Cherche dans les souvenirs du compte.", { query: { type: "string" } }),
    spec("save_memory", "Enregistre un souvenir. Une catégorie santé, argent ou privé exige agreed true.", { content: { type: "string" }, category: { type: "string" }, agreed: { type: "boolean" }, origin: { type: "string" } }),
    spec("generate_daily_plan", "Lit le jour et prépare une réponse. N’enregistre pas de plan.", { date: day }),
    spec("generate_weekly_review", "Lit sept jours et prépare une réponse. N’enregistre pas de bilan.", { date: day }),
  ];
}

function spec(name: AiToolName, description: string, properties: Record<string, unknown>) {
  return { type: "function" as const, function: { name, description, parameters: { type: "object" as const, properties } } };
}

const GOAL_DOMAINS: Record<string, string> = {
  personal: "personal",
  personnel: "personal",
  habits: "habits",
  habitude: "habits",
  habitudes: "habits",
  family: "family",
  famille: "family",
  couple: "couple",
  wellbeing: "wellbeing",
  sante: "wellbeing",
  santé: "wellbeing",
  "bien-être": "wellbeing",
  "bien etre": "wellbeing",
  work: "work",
  travail: "work",
  leisure: "leisure",
  loisir: "leisure",
  loisirs: "leisure",
};

function interpretCoach(name: AiToolName, input: Record<string, unknown>): ToolDecision {
  if (name === "create_routine") {
    const title = textOf(input.title, TITLE_LIMIT);
    if (!title) {
      return { kind: "question", question: "Quel est le titre ?" };
    }
    const steps = routineSteps(input.steps);
    if (steps === "missing") {
      return { kind: "question", question: "Quelles étapes ?" };
    }
    if (steps === "invalid") {
      return { kind: "question", question: "Huit étapes maximum, quatre-vingts caractères chacune." };
    }
    const dueTime = routineClock(input);
    if (dueTime === "invalid") {
      return { kind: "question", question: "À quelle heure ?" };
    }
    const recurrence = routineRecurrence(input.recurrence);
    if (recurrence === "invalid") {
      return { kind: "question", question: "Quelle répétition ?" };
    }
    return { kind: "create_routine", title, dueTime, recurrence: recurrence === "missing" ? "daily" : recurrence, steps };
  }
  if (name === "create_goal") {
    const title = textOf(input.title, TITLE_LIMIT);
    if (!title) {
      return { kind: "question", question: "Quel est le titre ?" };
    }
    const domain = goalDomain(input.domain);
    if (!domain) {
      return { kind: "question", question: "Quel domaine ?" };
    }
    return { kind: "create_goal", title, domain };
  }
  const id = goalId(input);
  if (!id) {
    return { kind: "question", question: "Quel objectif ?" };
  }
  const title = input.title === undefined ? undefined : textOf(input.title, TITLE_LIMIT);
  if (input.title !== undefined && !title) {
    return { kind: "question", question: "Quel est le titre ?" };
  }
  const domain = input.domain === undefined ? undefined : goalDomain(input.domain);
  if (input.domain !== undefined && !domain) {
    return { kind: "question", question: "Quel domaine ?" };
  }
  if (!title && !domain) {
    return { kind: "question", question: "Que faut-il modifier ?" };
  }
  return { kind: "update_goal", id, title: title ?? undefined, domain: domain ?? undefined };
}

function routineSteps(value: unknown): string[] | "missing" | "invalid" {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\n|;/) : null;
  if (!raw) {
    return "missing";
  }
  const steps = raw.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0);
  if (steps.length < 1) {
    return "missing";
  }
  if (steps.length > 8 || steps.some((step) => step.length > TITLE_LIMIT)) {
    return "invalid";
  }
  return steps;
}

function routineRecurrence(value: unknown): "none" | "daily" | "weekdays" | "missing" | "invalid" {
  if (value === undefined || value === null || value === "") {
    return "missing";
  }
  const recurrence = recurrenceOf(value);
  if (recurrence === "none" || recurrence === "daily" || recurrence === "weekdays") {
    return recurrence;
  }
  return "invalid";
}

function routineClock(input: Record<string, unknown>): string | null | "invalid" {
  const present = first(input, ["time", "dueTime", "due_time"]);
  if (present === undefined) {
    return null;
  }
  return clockOf(present);
}

function goalDomain(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return GOAL_DOMAINS[value.trim().toLowerCase()] ?? null;
}

function goalId(input: Record<string, unknown>): string | null {
  const value = first(input, ["id", "goal_id", "goalId"]);
  return typeof value === "string" && TASK_ID.test(value) ? value : null;
}

function interpretCreate(name: AiToolName, input: Record<string, unknown>, todayKey: string): ToolDecision {
  const title = textOf(input.title, TITLE_LIMIT);
  if (!title) {
    return { kind: "question", question: "Quel est le titre ?" };
  }
  const provided = explicitDate(input, todayKey);
  const dateKey = provided === "missing" && name === "create_recurring_reminder" ? validDate(todayKey) : provided === "missing" ? null : provided;
  if (!dateKey) {
    return { kind: "question", question: "Quel jour ?" };
  }
  const dueTime = clockOf(first(input, ["time", "due_time", "dueTime"]));
  if (dueTime === "invalid" || ((name === "create_reminder" || name === "create_recurring_reminder") && !dueTime)) {
    return { kind: "question", question: "À quelle heure ?" };
  }
  const recurrence = recurrenceOf(input.recurrence);
  if (name === "create_recurring_reminder" && (!recurrence || recurrence === "none")) {
    return { kind: "question", question: "Quelle répétition ?" };
  }
  if (input.recurrence !== undefined && !recurrence) {
    return { kind: "question", question: "Quelle répétition ?" };
  }
  const context = input.context === undefined ? "" : textOf(input.context, 80);
  if (context === null) {
    return { kind: "question", question: "Quel contexte ?" };
  }
  if (input.priority !== undefined && typeof input.priority !== "boolean") {
    return { kind: "question", question: "Est-ce une priorité ?" };
  }
  return {
    kind: "create_task",
    task: {
      title,
      dateKey,
      dueTime,
      priority: input.priority === true,
      context,
      recurrence: recurrence ?? "none",
    },
  };
}

function interpretUpdate(name: AiToolName, input: Record<string, unknown>, todayKey: string): ToolDecision {
  const id = taskId(input);
  if (!id) {
    return { kind: "question", question: "Quelle tâche ?" };
  }
  const patch: TaskPatch = {};
  if (input.title !== undefined) {
    const title = textOf(input.title, TITLE_LIMIT);
    if (!title) {
      return { kind: "question", question: "Quel est le titre ?" };
    }
    patch.title = title;
  }
  if (has(input, ["date", "date_key", "dateKey"])) {
    const dateKey = namedDate(input, todayKey);
    if (!dateKey) {
      return { kind: "question", question: "Quel jour ?" };
    }
    patch.dateKey = dateKey;
  }
  if (has(input, ["time", "due_time", "dueTime"])) {
    const dueTime = clockOf(first(input, ["time", "due_time", "dueTime"]));
    if (dueTime === "invalid") {
      return { kind: "question", question: "À quelle heure ?" };
    }
    patch.dueTime = dueTime;
  }
  if (input.priority !== undefined) {
    if (typeof input.priority !== "boolean") {
      return { kind: "question", question: "Est-ce une priorité ?" };
    }
    patch.priority = input.priority;
  }
  if (input.context !== undefined) {
    const context = textOf(input.context, 80);
    if (context === null) {
      return { kind: "question", question: "Quel contexte ?" };
    }
    patch.context = context;
  }
  if (input.recurrence !== undefined) {
    const recurrence = recurrenceOf(input.recurrence);
    if (!recurrence) {
      return { kind: "question", question: "Quelle répétition ?" };
    }
    patch.recurrence = recurrence;
  }
  if (Object.keys(patch).length === 0) {
    return { kind: "question", question: name === "reschedule_task" ? "Quel jour, ou quelle heure ?" : "Que faut-il modifier ?" };
  }
  return { kind: "update_task", id, patch };
}

function interpretSearch(input: Record<string, unknown>): ToolDecision {
  const query = textOf(input.query, 80);
  if (!query) {
    return { kind: "question", question: "Que faut-il chercher ?" };
  }
  return { kind: "search_memory", query };
}

function interpretMemory(input: Record<string, unknown>): ToolDecision {
  const content = textOf(first(input, ["content", "text"]), 400);
  if (!content) {
    return { kind: "question", question: "Que faut-il retenir ?" };
  }
  const category = categoryOf(input.category);
  if (!category) {
    return { kind: "question", question: "Quelle catégorie ?" };
  }
  const sensitive = SENSITIVE.includes(category);
  if (sensitive && input.agreed !== true) {
    return { kind: "question", question: "Tu confirmes d’enregistrer cette information sensible ?" };
  }
  const origin = input.origin === "confirmed_suggestion" ? "confirmed_suggestion" : "user";
  return { kind: "save_memory", content, category, sensitive, origin };
}

function isToolName(name: string): name is AiToolName {
  return (AI_TOOL_NAMES as readonly string[]).includes(name);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function has(input: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(input, key));
}

function first(input: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return input[key];
    }
  }
  return undefined;
}

function textOf(value: unknown, limit: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  if (text.length < 1 || text.length > limit) {
    return null;
  }
  return text;
}

function taskId(input: Record<string, unknown>): string | null {
  const value = first(input, ["id", "task_id", "taskId"]);
  return typeof value === "string" && TASK_ID.test(value) ? value : null;
}

function namedDate(input: Record<string, unknown>, todayKey: string): string | null {
  return resolveDate(first(input, ["date", "date_key", "dateKey"]), todayKey);
}

function resolveDate(value: unknown, todayKey: string): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().toLowerCase();
  if (text === "today" || text === "aujourd'hui" || text === "aujourd’hui") {
    return validDate(todayKey);
  }
  if (text === "demain" || text === "tomorrow") {
    return shiftDate(todayKey, 1);
  }
  if (text === "hier" || text === "yesterday") {
    return shiftDate(todayKey, -1);
  }
  return validDate(value.trim());
}

export function isDateKey(value: string): boolean {
  return validDate(value) !== null;
}

function explicitDate(input: Record<string, unknown>, todayKey: string): string | null | "missing" {
  if (!has(input, ["date", "date_key", "dateKey"])) {
    return "missing";
  }
  return namedDate(input, todayKey);
}

function validDate(value: string): string | null {
  try {
    parseDateKey(value);
    return value;
  } catch {
    return null;
  }
}

function shiftDate(value: string, amount: number): string | null {
  const dateKey = validDate(value);
  if (!dateKey) {
    return null;
  }
  return addDays(dateKey, amount);
}

function clockOf(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return "invalid";
  }
  return parseClock(value) ?? "invalid";
}

function recurrenceOf(value: unknown): Recurrence | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().toLowerCase();
  if (text === "none" || text === "aucune" || text === "aucun") {
    return "none";
  }
  if (text === "daily" || text === "jour" || text === "chaque jour") {
    return "daily";
  }
  if (text === "weekly" || text === "semaine" || text === "chaque semaine") {
    return "weekly";
  }
  if (text === "weekdays" || text === "ouvres" || text === "ouvrés" || text === "jours ouvres" || text === "jours ouvrés") {
    return "weekdays";
  }
  return null;
}

function categoryOf(value: unknown): MemoryCategory | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().toLowerCase();
  if (text === "preference" || text === "préférence") {
    return "preference";
  }
  if (text === "fact" || text === "fait") {
    return "fact";
  }
  if (text === "person" || text === "personne") {
    return "person";
  }
  if (text === "health" || text === "sante" || text === "santé") {
    return "health";
  }
  if (text === "finance" || text === "argent") {
    return "finance";
  }
  if (text === "private" || text === "prive" || text === "privé") {
    return "private";
  }
  return null;
}
