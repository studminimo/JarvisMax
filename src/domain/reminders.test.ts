import { EMPTY_BOARD, addTask } from "./board";
import { planReminders, taskFromRow } from "./reminders";

function must<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

describe("rappels", () => {
  const now = new Date("2026-11-19T06:00:00Z");

  it("programme le rappel principal dans les 48 heures", () => {
    const board = must(
      addTask(EMPTY_BOARD, { id: "task-1", title: "Appeler", dateKey: "2026-11-19", priority: false, dueTime: "09:00" }),
    );
    const plan = planReminders({
      tasks: board.tasks,
      now,
      timeZone: "Europe/Paris",
      dayStart: "07:00",
      profile: "normal",
    });
    expect(plan).toEqual([
      {
        key: "jarvis:task:task-1:primary:2026-11-19T08:00:00Z",
        taskId: "task-1",
        kind: "primary",
        fireAt: "2026-11-19T08:00:00Z",
        title: "Appeler",
      },
    ]);
  });

  it("ajoute l’anticipation et le retard pour le profil intensif, et rien au repos", () => {
    const board = must(
      addTask(EMPTY_BOARD, { id: "task-1", title: "Appeler", dateKey: "2026-11-19", priority: false, dueTime: "09:00" }),
    );
    const intensive = planReminders({
      tasks: board.tasks,
      now,
      timeZone: "Europe/Paris",
      dayStart: "07:00",
      profile: "intensive",
    });
    expect(intensive.map((item) => item.kind)).toEqual(["anticipatory", "primary", "overdue"]);
    expect(
      planReminders({
        tasks: board.tasks,
        now,
        timeZone: "Europe/Paris",
        dayStart: "07:00",
        profile: "rest",
      }),
    ).toEqual([]);
  });

  it("ignore une tâche terminée, déjà ignorée, ou hors fenêtre", () => {
    const done = must(
      addTask(EMPTY_BOARD, { id: "task-1", title: "Appeler", dateKey: "2026-11-19", priority: false, dueTime: "09:00" }),
    );
    const finished = { ...done.tasks[0], done: true };
    const ignored = { ...done.tasks[0], ignoredOn: "2026-11-19" };
    const past = must(
      addTask(EMPTY_BOARD, { id: "task-2", title: "Hier", dateKey: "2026-11-18", priority: false, dueTime: "09:00" }),
    );
    const base = { now, timeZone: "Europe/Paris", dayStart: "07:00", profile: "normal" as const };
    expect(planReminders({ ...base, tasks: [finished] })).toEqual([]);
    expect(planReminders({ ...base, tasks: [ignored] })).toEqual([]);
    expect(planReminders({ ...base, tasks: past.tasks })).toEqual([]);
  });

  it("borne le plan et lit une ligne distante", () => {
    const tasks = Array.from({ length: 3 }, (_, index) => {
      const created = must(
        addTask(EMPTY_BOARD, {
          id: `task-${index + 1}`,
          title: `Tâche ${index + 1}`,
          dateKey: "2026-11-19",
          priority: false,
          dueTime: "09:00",
        }),
      );
      return created.tasks[0];
    });
    expect(
      planReminders({
        tasks,
        now,
        timeZone: "Europe/Paris",
        dayStart: "07:00",
        profile: "normal",
        limit: 2,
      }),
    ).toHaveLength(2);
    expect(
      taskFromRow({
        id: "task-1",
        title: "Appeler",
        date_key: "2026-11-19",
        due_time: "09:00:00",
        done: false,
        priority: true,
        context: "",
        recurrence: "daily",
        ignored_on: null,
      }),
    ).toMatchObject({
      ok: true,
      value: { dueTime: "09:00", recurrence: "daily", priority: true },
    });
    expect(taskFromRow({ id: "task-1", title: "Appeler" })).toEqual({ ok: false, error: "Tâche illisible" });
  });
});
