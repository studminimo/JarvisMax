import { GOAL_DOMAINS, type GoalDomainId } from "./goals";
import { type HomeSnapshot } from "./home";
import { err, ok, type Result } from "./result";
import { addDays, parseClock, parseDateKey, weekdayIndexMonday, type Greeting } from "./time";

export const TITLE_LIMIT = 80;
export const NAME_LIMIT = 40;
export const DRAFT_LIMIT = 400;

export const RECURRENCES = ["none", "daily", "weekly", "weekdays"] as const;

export type Recurrence = (typeof RECURRENCES)[number];

export type BoardTask = {
  id: string;
  title: string;
  dateKey: string;
  dueTime: string | null;
  done: boolean;
  priority: boolean;
  context: string;
  recurrence: Recurrence;
  ignoredOn: string | null;
};

export type BoardHabit = {
  id: string;
  title: string;
  done: boolean;
};

export type BoardGoal = {
  id: string;
  title: string;
  domainId: GoalDomainId;
};

export type Board = {
  tasks: readonly BoardTask[];
  habits: readonly BoardHabit[];
  goals: readonly BoardGoal[];
  givenName: string;
  draft: string;
};

export const EMPTY_BOARD: Board = {
  tasks: [],
  habits: [],
  goals: [],
  givenName: "",
  draft: "",
};

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function takeId(id: string, items: readonly { id: string }[]): Result<string> {
  const clean = id.trim();
  if (clean.length === 0) {
    return err("Identifiant manquant");
  }
  if (items.some((item) => item.id === clean)) {
    return err("Identifiant déjà utilisé");
  }
  return ok(clean);
}

function takeTitle(title: string): Result<string> {
  const clean = cleanText(title);
  if (clean.length === 0) {
    return err("Le titre est vide");
  }
  if (clean.length > TITLE_LIMIT) {
    return err(`${TITLE_LIMIT} caractères maximum`);
  }
  return ok(clean);
}

function takeDate(dateKey: string): Result<string> {
  try {
    parseDateKey(dateKey);
    return ok(dateKey);
  } catch {
    return err("Date invalide");
  }
}

function takeDueTime(value: string | null | undefined): Result<string | null> {
  if (value === undefined || value === null || value.trim() === "") {
    return ok(null);
  }
  const clock = parseClock(value);
  if (!clock) {
    return err("Heure invalide");
  }
  return ok(clock);
}

function takeContext(value: string): Result<string> {
  const clean = cleanText(value);
  if (clean.length > TITLE_LIMIT) {
    return err(`${TITLE_LIMIT} caractères maximum`);
  }
  return ok(clean);
}

export function isRecurrence(value: string): value is Recurrence {
  return (RECURRENCES as readonly string[]).includes(value);
}

export function nextOccurrence(dateKey: string, recurrence: Recurrence): string {
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

function addMinutes(clock: string, minutes: number): { clock: string; dayOffset: number } | null {
  const parsed = parseClock(clock);
  if (!parsed || !Number.isInteger(minutes)) {
    return null;
  }
  const [hour, minute] = parsed.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const dayOffset = Math.floor(total / 1440);
  const within = ((total % 1440) + 1440) % 1440;
  const nextHour = Math.floor(within / 60);
  const nextMinute = within % 60;
  return {
    clock: `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`,
    dayOffset,
  };
}

function isDomain(value: string): value is GoalDomainId {
  return GOAL_DOMAINS.some((domain) => domain.id === value);
}

export function addTask(
  board: Board,
  input: {
    id: string;
    title: string;
    dateKey: string;
    priority: boolean;
    dueTime?: string | null;
    context?: string;
    recurrence?: Recurrence;
  },
): Result<Board> {
  const id = takeId(input.id, board.tasks);
  if (!id.ok) {
    return id;
  }
  const title = takeTitle(input.title);
  if (!title.ok) {
    return title;
  }
  const dateKey = takeDate(input.dateKey);
  if (!dateKey.ok) {
    return dateKey;
  }
  const dueTime = takeDueTime(input.dueTime);
  if (!dueTime.ok) {
    return dueTime;
  }
  const context = takeContext(input.context ?? "");
  if (!context.ok) {
    return context;
  }
  const recurrence = input.recurrence ?? "none";
  if (!isRecurrence(recurrence)) {
    return err("Répétition inconnue");
  }
  const task: BoardTask = {
    id: id.value,
    title: title.value,
    dateKey: dateKey.value,
    dueTime: dueTime.value,
    done: false,
    priority: input.priority,
    context: context.value,
    recurrence,
    ignoredOn: null,
  };
  return ok({ ...board, tasks: [...board.tasks, task] });
}

function mapTask(board: Board, id: string, update: (task: BoardTask) => BoardTask): Result<Board> {
  const index = board.tasks.findIndex((task) => task.id === id);
  if (index < 0) {
    return err("Tâche introuvable");
  }
  const tasks = board.tasks.map((task, position) => (position === index ? update(task) : task));
  return ok({ ...board, tasks });
}

export function toggleTask(board: Board, id: string): Result<Board> {
  return mapTask(board, id, (task) => {
    if (!task.done && task.recurrence !== "none") {
      return {
        ...task,
        done: false,
        dateKey: nextOccurrence(task.dateKey, task.recurrence),
        ignoredOn: null,
      };
    }
    return { ...task, done: !task.done };
  });
}

export function setTaskPriority(board: Board, id: string, priority: boolean): Result<Board> {
  return mapTask(board, id, (task) => ({ ...task, priority }));
}

export function removeTask(board: Board, id: string): Result<Board> {
  if (!board.tasks.some((task) => task.id === id)) {
    return err("Tâche introuvable");
  }
  return ok({ ...board, tasks: board.tasks.filter((task) => task.id !== id) });
}

export function moveTask(board: Board, id: string, dateKey: string): Result<Board> {
  const date = takeDate(dateKey);
  if (!date.ok) {
    return date;
  }
  return mapTask(board, id, (task) => ({ ...task, dateKey: date.value, ignoredOn: null }));
}

export function postponeTask(board: Board, id: string): Result<Board> {
  return mapTask(board, id, (task) => ({
    ...task,
    dateKey: addDays(task.dateKey, 1),
    ignoredOn: null,
  }));
}

export function shiftTaskMinutes(
  board: Board,
  id: string,
  minutes: number,
  now: { hour: number; minute: number },
): Result<Board> {
  if (!Number.isInteger(minutes) || minutes === 0) {
    return err("Décalage invalide");
  }
  const current = board.tasks.find((task) => task.id === id);
  if (!current) {
    return err("Tâche introuvable");
  }
  const base =
    current.dueTime ??
    `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`;
  const shifted = addMinutes(base, minutes);
  if (!shifted || !parseClock(base)) {
    return err("Heure invalide");
  }
  return mapTask(board, id, (task) => ({
    ...task,
    dueTime: shifted.clock,
    dateKey: addDays(task.dateKey, shifted.dayOffset),
    ignoredOn: null,
  }));
}

export function ignoreTask(board: Board, id: string): Result<Board> {
  return mapTask(board, id, (task) => ({ ...task, ignoredOn: task.dateKey }));
}

export function setRecurrence(board: Board, id: string, recurrence: Recurrence): Result<Board> {
  if (!isRecurrence(recurrence)) {
    return err("Répétition inconnue");
  }
  return mapTask(board, id, (task) => ({ ...task, recurrence }));
}

export function addHabit(board: Board, input: { id: string; title: string }): Result<Board> {
  const id = takeId(input.id, board.habits);
  if (!id.ok) {
    return id;
  }
  const title = takeTitle(input.title);
  if (!title.ok) {
    return title;
  }
  return ok({ ...board, habits: [...board.habits, { id: id.value, title: title.value, done: false }] });
}

export function toggleHabit(board: Board, id: string): Result<Board> {
  const index = board.habits.findIndex((habit) => habit.id === id);
  if (index < 0) {
    return err("Habitude introuvable");
  }
  const habits = board.habits.map((habit, position) =>
    position === index ? { ...habit, done: !habit.done } : habit,
  );
  return ok({ ...board, habits });
}

export function removeHabit(board: Board, id: string): Result<Board> {
  if (!board.habits.some((habit) => habit.id === id)) {
    return err("Habitude introuvable");
  }
  return ok({ ...board, habits: board.habits.filter((habit) => habit.id !== id) });
}

export function addGoal(
  board: Board,
  input: { id: string; title: string; domainId: GoalDomainId },
): Result<Board> {
  const id = takeId(input.id, board.goals);
  if (!id.ok) {
    return id;
  }
  const title = takeTitle(input.title);
  if (!title.ok) {
    return title;
  }
  if (!isDomain(input.domainId)) {
    return err("Domaine inconnu");
  }
  const goal: BoardGoal = { id: id.value, title: title.value, domainId: input.domainId };
  return ok({ ...board, goals: [...board.goals, goal] });
}

export function removeGoal(board: Board, id: string): Result<Board> {
  if (!board.goals.some((goal) => goal.id === id)) {
    return err("Objectif introuvable");
  }
  return ok({ ...board, goals: board.goals.filter((goal) => goal.id !== id) });
}

export function setGivenName(board: Board, name: string): Result<Board> {
  const givenName = cleanText(name);
  if (givenName.length === 0) {
    return err("Le prénom est vide");
  }
  if (givenName.length > NAME_LIMIT) {
    return err(`${NAME_LIMIT} caractères maximum`);
  }
  return ok({ ...board, givenName });
}

export function clearGivenName(board: Board): Board {
  return { ...board, givenName: "" };
}

export function writeDraft(board: Board, draft: string): Board {
  return { ...board, draft: draft.slice(0, DRAFT_LIMIT) };
}

export function clearDraft(board: Board): Board {
  return { ...board, draft: "" };
}

function byAgenda(tasks: readonly BoardTask[]): BoardTask[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort(
      (left, right) =>
        Number(left.task.done) - Number(right.task.done) ||
        left.task.dateKey.localeCompare(right.task.dateKey) ||
        left.index - right.index,
    )
    .map((item) => item.task);
}

export function openTasks(board: Board): BoardTask[] {
  return byAgenda(board.tasks.filter((task) => !task.done));
}

export function priorityTasks(board: Board): BoardTask[] {
  return byAgenda(board.tasks.filter((task) => task.priority && !task.done));
}

export function tasksOnDate(board: Board, dateKey: string): BoardTask[] {
  parseDateKey(dateKey);
  return byAgenda(board.tasks.filter((task) => task.dateKey === dateKey));
}

export function goalsInDomain(board: Board, domainId: GoalDomainId): BoardGoal[] {
  return board.goals.filter((goal) => goal.domainId === domainId);
}

export function goalCounts(board: Board): Partial<Record<GoalDomainId, number>> {
  const counts: Partial<Record<GoalDomainId, number>> = {};
  for (const goal of board.goals) {
    counts[goal.domainId] = (counts[goal.domainId] ?? 0) + 1;
  }
  return counts;
}

export function boardToHome(board: Board, todayKey: string): HomeSnapshot {
  parseDateKey(todayKey);
  const today = board.tasks.filter((task) => task.dateKey === todayKey);
  const next = openTasks(board)[0];
  return {
    nextTaskTitle: next?.title ?? null,
    hasRecordedTask: board.tasks.length > 0,
    dayCount: today.length,
    priorities: priorityTasks(board).map((task) => task.title),
    habits: board.habits.filter((habit) => !habit.done).map((habit) => habit.title),
    completedCount: today.filter((task) => task.done).length,
    totalCount: today.length,
  };
}

export function greetingLine(greeting: Greeting, givenName: string): string {
  const name = givenName.trim();
  if (name.length === 0) {
    return greeting;
  }
  return `${greeting}, ${name}`;
}
