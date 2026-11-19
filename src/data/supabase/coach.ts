import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isCoachMode,
  type CoachMode,
  type Routine,
  type RoutineDraft,
  type RoutineStep,
} from "@/domain/coach";
import { GOAL_DOMAINS, type GoalDomainId } from "@/domain/goals";
import { err, ok, type Result } from "@/domain/result";

const FAILURE = "Le serveur n’a pas répondu.";

export type CoachGoal = { id: string; title: string; domainId: GoalDomainId };
export type CoachHabit = { id: string; title: string; done: boolean };

export type CoachBundle = {
  mode: CoachMode;
  routines: Routine[];
  goals: CoachGoal[];
  habits: CoachHabit[];
  note: string;
};

export async function loadCoachBundle(client: SupabaseClient, userId: string, todayKey: string): Promise<Result<CoachBundle>> {
  const [profile, routines, steps, goals, habits, logs, review] = await Promise.all([
    client.from("profiles").select("coach_mode").eq("user_id", userId).maybeSingle(),
    client.from("routines").select("id, title, due_time, recurrence").eq("user_id", userId),
    client.from("routine_steps").select("id, routine_id, position, title, done_on").eq("user_id", userId),
    client.from("goals").select("id, domain, title").eq("user_id", userId),
    client.from("habits").select("id, title").eq("user_id", userId),
    client.from("habit_logs").select("habit_id").eq("user_id", userId).eq("date_key", todayKey),
    client.from("reviews").select("content").eq("user_id", userId).eq("date_key", todayKey).maybeSingle(),
  ]);
  if (profile.error || routines.error || steps.error || goals.error || habits.error || logs.error || review.error) {
    return err("Le coach n’est pas disponible.");
  }
  const mode = typeof profile.data?.coach_mode === "string" && isCoachMode(profile.data.coach_mode) ? profile.data.coach_mode : null;
  if (!mode) {
    return err("Le coach n’est pas disponible.");
  }
  const built = buildRoutines(routines.data, steps.data);
  const goalRows = readGoals(goals.data);
  const habitRows = readHabits(habits.data, logs.data);
  if (!built || !goalRows || !habitRows) {
    return err("Le coach n’est pas disponible.");
  }
  const note = typeof review.data?.content === "string" ? review.data.content : "";
  return ok({ mode, routines: built, goals: goalRows, habits: habitRows, note });
}

export async function saveCoachMode(client: SupabaseClient, userId: string, mode: CoachMode): Promise<Result<CoachMode>> {
  const { data, error } = await client
    .from("profiles")
    .update({ coach_mode: mode })
    .eq("user_id", userId)
    .select("coach_mode")
    .maybeSingle();
  if (error || data?.coach_mode !== mode) {
    return err(FAILURE);
  }
  return ok(mode);
}

export async function saveRoutine(client: SupabaseClient, userId: string, draft: RoutineDraft): Promise<Result<Routine>> {
  const routineId = globalThis.crypto?.randomUUID?.() ?? "";
  if (!routineId) {
    return err(FAILURE);
  }
  const created = await client
    .from("routines")
    .insert({ id: routineId, user_id: userId, title: draft.title, due_time: draft.dueTime, recurrence: draft.recurrence })
    .select("id, title, due_time, recurrence")
    .maybeSingle();
  if (created.error || created.data?.id !== routineId || created.data.title !== draft.title) {
    return err(FAILURE);
  }
  const steps = draft.steps.map((title, index) => ({
    id: globalThis.crypto.randomUUID(),
    user_id: userId,
    routine_id: routineId,
    position: index + 1,
    title,
    done_on: null,
  }));
  const inserted = await client.from("routine_steps").insert(steps).select("id, position, title, done_on");
  if (inserted.error || !Array.isArray(inserted.data) || inserted.data.length !== steps.length) {
    await client.from("routines").delete().eq("id", routineId).eq("user_id", userId);
    return err(FAILURE);
  }
  const routine = routineFrom(created.data, inserted.data);
  return routine ? ok(routine) : err(FAILURE);
}

export async function saveStepDone(
  client: SupabaseClient,
  userId: string,
  stepId: string,
  doneOn: string | null,
): Promise<Result<string | null>> {
  const { data, error } = await client
    .from("routine_steps")
    .update({ done_on: doneOn })
    .eq("id", stepId)
    .eq("user_id", userId)
    .select("done_on")
    .maybeSingle();
  if (error || !data || data.done_on !== doneOn) {
    return err(FAILURE);
  }
  return ok(doneOn);
}

export async function saveGoal(
  client: SupabaseClient,
  userId: string,
  goal: CoachGoal,
): Promise<Result<CoachGoal>> {
  const { data, error } = await client
    .from("goals")
    .insert({ id: goal.id, user_id: userId, domain: goal.domainId, title: goal.title })
    .select("id, domain, title")
    .maybeSingle();
  const read = data ? readGoal(data) : null;
  if (error || !read || read.id !== goal.id || read.title !== goal.title || read.domainId !== goal.domainId) {
    return err(FAILURE);
  }
  return ok(read);
}

export async function removeGoal(client: SupabaseClient, userId: string, id: string): Promise<Result<string>> {
  const { data, error } = await client.from("goals").delete().eq("id", id).eq("user_id", userId).select("id");
  if (error || !Array.isArray(data) || data[0]?.id !== id) {
    return err(FAILURE);
  }
  return ok(id);
}

export async function saveHabit(client: SupabaseClient, userId: string, habit: CoachHabit): Promise<Result<CoachHabit>> {
  const { data, error } = await client
    .from("habits")
    .insert({ id: habit.id, user_id: userId, title: habit.title })
    .select("id, title")
    .maybeSingle();
  if (error || data?.id !== habit.id || data.title !== habit.title) {
    return err(FAILURE);
  }
  return ok({ id: habit.id, title: habit.title, done: false });
}

export async function removeHabit(client: SupabaseClient, userId: string, id: string): Promise<Result<string>> {
  const { data, error } = await client.from("habits").delete().eq("id", id).eq("user_id", userId).select("id");
  if (error || !Array.isArray(data) || data[0]?.id !== id) {
    return err(FAILURE);
  }
  return ok(id);
}

export async function saveHabitDone(
  client: SupabaseClient,
  userId: string,
  habitId: string,
  todayKey: string,
  done: boolean,
): Promise<Result<boolean>> {
  if (done) {
    const { data, error } = await client
      .from("habit_logs")
      .insert({ user_id: userId, habit_id: habitId, date_key: todayKey })
      .select("habit_id, date_key")
      .maybeSingle();
    if (error || data?.habit_id !== habitId || data.date_key !== todayKey) {
      return err(FAILURE);
    }
    return ok(true);
  }
  const { data, error } = await client
    .from("habit_logs")
    .delete()
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .eq("date_key", todayKey)
    .select("habit_id");
  if (error || !Array.isArray(data) || data.length === 0) {
    return err(FAILURE);
  }
  return ok(false);
}

export async function saveDayNote(
  client: SupabaseClient,
  userId: string,
  todayKey: string,
  content: string,
): Promise<Result<string>> {
  const existing = await client.from("reviews").select("id").eq("user_id", userId).eq("date_key", todayKey).maybeSingle();
  if (existing.error) {
    return err(FAILURE);
  }
  const written = existing.data?.id
    ? await client.from("reviews").update({ content }).eq("id", existing.data.id).eq("user_id", userId).select("content").maybeSingle()
    : await client.from("reviews").insert({ user_id: userId, date_key: todayKey, content }).select("content").maybeSingle();
  if (written.error || written.data?.content !== content) {
    return err(FAILURE);
  }
  return ok(content);
}

function buildRoutines(routines: unknown, steps: unknown): Routine[] | null {
  if (!Array.isArray(routines) || !Array.isArray(steps)) {
    return null;
  }
  const grouped = new Map<string, RoutineStep[]>();
  for (const item of steps) {
    const step = readStep(item);
    if (!step) {
      return null;
    }
    const list = grouped.get(step.routineId) ?? [];
    list.push(step.step);
    grouped.set(step.routineId, list);
  }
  const result: Routine[] = [];
  for (const item of routines) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.title !== "string") {
      return null;
    }
    if (row.recurrence !== "none" && row.recurrence !== "daily" && row.recurrence !== "weekdays") {
      return null;
    }
    const dueTime = row.due_time == null ? null : typeof row.due_time === "string" ? row.due_time.slice(0, 5) : null;
    if (row.due_time != null && !dueTime) {
      return null;
    }
    const routineSteps = (grouped.get(row.id) ?? []).sort((left, right) => left.position - right.position);
    result.push({ id: row.id, title: row.title, dueTime, recurrence: row.recurrence, steps: routineSteps });
  }
  return result;
}

function readStep(value: unknown): { routineId: string; step: RoutineStep } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.routine_id !== "string" ||
    typeof row.position !== "number" ||
    typeof row.title !== "string"
  ) {
    return null;
  }
  const doneOn = row.done_on == null ? null : typeof row.done_on === "string" ? row.done_on : null;
  if (row.done_on != null && !doneOn) {
    return null;
  }
  return { routineId: row.routine_id, step: { id: row.id, title: row.title, position: row.position, doneOn } };
}

function routineFrom(routine: Record<string, unknown>, steps: unknown[]): Routine | null {
  if (typeof routine.id !== "string" || typeof routine.title !== "string") {
    return null;
  }
  if (routine.recurrence !== "none" && routine.recurrence !== "daily" && routine.recurrence !== "weekdays") {
    return null;
  }
  const dueTime = routine.due_time == null ? null : typeof routine.due_time === "string" ? routine.due_time.slice(0, 5) : null;
  const parsed = steps
    .map((item) => readStep({ ...(item as object), routine_id: routine.id }))
    .filter((item): item is { routineId: string; step: RoutineStep } => item !== null)
    .map((item) => item.step)
    .sort((left, right) => left.position - right.position);
  if (parsed.length !== steps.length) {
    return null;
  }
  return { id: routine.id, title: routine.title, dueTime, recurrence: routine.recurrence, steps: parsed };
}

function readGoals(value: unknown): CoachGoal[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const goals: CoachGoal[] = [];
  for (const item of value) {
    const goal = readGoal(item);
    if (!goal) {
      return null;
    }
    goals.push(goal);
  }
  return goals;
}

function readGoal(value: unknown): CoachGoal | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const domain = GOAL_DOMAINS.find((item) => item.id === row.domain);
  if (typeof row.id !== "string" || typeof row.title !== "string" || !domain) {
    return null;
  }
  return { id: row.id, title: row.title, domainId: domain.id };
}

function readHabits(habits: unknown, logs: unknown): CoachHabit[] | null {
  if (!Array.isArray(habits) || !Array.isArray(logs)) {
    return null;
  }
  const done = new Set(logs.map((item) => (item && typeof item === "object" ? (item as { habit_id?: unknown }).habit_id : null)));
  const result: CoachHabit[] = [];
  for (const item of habits) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.title !== "string") {
      return null;
    }
    result.push({ id: row.id, title: row.title, done: done.has(row.id) });
  }
  return result;
}
