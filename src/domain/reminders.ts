import { EMPTY_BOARD, addTask, isRecurrence, type BoardTask } from "./board";
import { notificationKey, type NotificationKind } from "./notifications/key";
import { err, ok, type Result } from "./result";
import { addDays, instantStamp, parseClock, parseDateKey, zonedInstant } from "./time";

export { isDuePush, PUSH_GRACE_MS } from "../../supabase/functions/reminders/due";

export const NOTIFICATION_PROFILES = ["normal", "intensive", "focus", "rest", "custom"] as const;

export type NotificationProfile = (typeof NOTIFICATION_PROFILES)[number];

export const REMINDER_HORIZON_HOURS = 48;
export const REMINDER_LIMIT = 64;

export type PlannedReminder = {
  key: string;
  taskId: string;
  kind: NotificationKind;
  fireAt: string;
  title: string;
};

const OFFSETS: Record<NotificationProfile, readonly { kind: NotificationKind; minutes: number }[]> = {
  rest: [],
  normal: [{ kind: "primary", minutes: 0 }],
  focus: [{ kind: "primary", minutes: 0 }],
  custom: [
    { kind: "anticipatory", minutes: -60 },
    { kind: "primary", minutes: 0 },
  ],
  intensive: [
    { kind: "anticipatory", minutes: -30 },
    { kind: "primary", minutes: 0 },
    { kind: "overdue", minutes: 15 },
  ],
};

export function isNotificationProfile(value: string): value is NotificationProfile {
  return (NOTIFICATION_PROFILES as readonly string[]).includes(value);
}

export function taskFromRow(row: unknown): Result<BoardTask> {
  if (!row || typeof row !== "object") {
    return err("Tâche illisible");
  }
  const record = row as Record<string, unknown>;
  const id = record.id;
  const title = record.title;
  const dateKey = record.date_key;
  const dueTime = record.due_time;
  const done = record.done;
  const priority = record.priority;
  const context = record.context;
  const recurrence = record.recurrence;
  const ignored = record.ignored_on;
  if (typeof id !== "string" || typeof title !== "string" || typeof dateKey !== "string") {
    return err("Tâche illisible");
  }
  if (typeof done !== "boolean" || typeof priority !== "boolean" || typeof context !== "string") {
    return err("Tâche illisible");
  }
  if (typeof recurrence !== "string" || !isRecurrence(recurrence)) {
    return err("Tâche illisible");
  }
  if (dueTime !== null && typeof dueTime !== "string") {
    return err("Tâche illisible");
  }
  let ignoredOn: string | null = null;
  if (ignored !== null && ignored !== undefined) {
    if (typeof ignored !== "string") {
      return err("Tâche illisible");
    }
    try {
      parseDateKey(ignored);
    } catch {
      return err("Tâche illisible");
    }
    ignoredOn = ignored;
  }
  const clock = dueTime === null ? null : parseClock(dueTime);
  if (dueTime !== null && !clock) {
    return err("Tâche illisible");
  }
  const created = addTask(EMPTY_BOARD, {
    id,
    title,
    dateKey,
    priority,
    dueTime: clock,
    context,
    recurrence,
  });
  if (!created.ok) {
    return err("Tâche illisible");
  }
  return ok({ ...created.value.tasks[0], done, ignoredOn });
}

function shiftClock(clock: string, minutes: number): { dateOffset: number; clock: string } | null {
  const parsed = parseClock(clock);
  if (!parsed) {
    return null;
  }
  const [hour, minute] = parsed.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const dateOffset = Math.floor(total / 1440);
  const within = ((total % 1440) + 1440) % 1440;
  return {
    dateOffset,
    clock: `${String(Math.floor(within / 60)).padStart(2, "0")}:${String(within % 60).padStart(2, "0")}`,
  };
}

export function planReminders(input: {
  tasks: readonly BoardTask[];
  now: Date;
  timeZone: string;
  dayStart: string;
  profile: NotificationProfile;
  horizonHours?: number;
  limit?: number;
}): PlannedReminder[] {
  const horizon = (input.horizonHours ?? REMINDER_HORIZON_HOURS) * 60 * 60 * 1000;
  const limit = input.limit ?? REMINDER_LIMIT;
  const start = input.now.getTime();
  const end = start + horizon;
  const planned: PlannedReminder[] = [];
  for (const task of input.tasks) {
    if (task.done || task.ignoredOn === task.dateKey) {
      continue;
    }
    const baseClock = task.dueTime ?? parseClock(input.dayStart);
    if (!baseClock) {
      continue;
    }
    for (const offset of OFFSETS[input.profile]) {
      const shifted = shiftClock(baseClock, offset.minutes);
      if (!shifted) {
        continue;
      }
      let dateKey = task.dateKey;
      if (shifted.dateOffset !== 0) {
        dateKey = addDays(dateKey, shifted.dateOffset);
      }
      const fire = zonedInstant(dateKey, shifted.clock, input.timeZone);
      const at = fire.getTime();
      if (at <= start || at > end) {
        continue;
      }
      const stamp = instantStamp(fire);
      try {
        planned.push({
          key: notificationKey({
            entityType: "task",
            entityId: task.id,
            kind: offset.kind,
            fireAt: stamp,
          }),
          taskId: task.id,
          kind: offset.kind,
          fireAt: stamp,
          title: task.title,
        });
      } catch {
        continue;
      }
    }
  }
  return planned.sort((left, right) => left.fireAt.localeCompare(right.fireAt) || left.key.localeCompare(right.key)).slice(0, limit);
}
