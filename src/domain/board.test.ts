import {
  EMPTY_BOARD,
  addGoal,
  addHabit,
  addTask,
  boardToHome,
  clearDraft,
  clearGivenName,
  goalCounts,
  goalsInDomain,
  greetingLine,
  ignoreTask,
  moveTask,
  nextOccurrence,
  openTasks,
  postponeTask,
  removeTask,
  setGivenName,
  setTaskPriority,
  shiftTaskMinutes,
  tasksOnDate,
  toggleHabit,
  toggleTask,
  writeDraft,
} from "./board";
import { type GoalDomainId } from "./goals";
import { EMPTY_HOME } from "./home";

function must<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

describe("tableau de session", () => {
  it("décrit un accueil vide", () => {
    expect(boardToHome(EMPTY_BOARD, "2026-11-18")).toEqual(EMPTY_HOME);
    expect(greetingLine("Bonjour", "  ")).toBe("Bonjour");
  });

  it("ajoute, ordonne et retire sans modifier la source", () => {
    const source = EMPTY_BOARD;
    const withLater = must(addTask(source, { id: "b", title: "  Plus tard ", dateKey: "2026-11-20", priority: false }));
    const withBoth = must(
      addTask(withLater, { id: "a", title: "D’abord", dateKey: "2026-11-18", priority: true }),
    );

    expect(source.tasks).toEqual([]);
    expect(openTasks(withBoth).map((task) => task.id)).toEqual(["a", "b"]);
    expect(boardToHome(withBoth, "2026-11-18")).toMatchObject({
      nextTaskTitle: "D’abord",
      hasRecordedTask: true,
      dayCount: 1,
      priorities: ["D’abord"],
      completedCount: 0,
      totalCount: 1,
    });

    const done = must(toggleTask(withBoth, "a"));
    expect(boardToHome(done, "2026-11-18").nextTaskTitle).toBe("Plus tard");
    expect(boardToHome(done, "2026-11-18").priorities).toEqual([]);
    expect(tasksOnDate(done, "2026-11-18").map((task) => task.done)).toEqual([true]);

    const ordinary = must(setTaskPriority(withBoth, "a", false));
    expect(boardToHome(ordinary, "2026-11-18").priorities).toEqual([]);

    const removed = must(removeTask(withBoth, "b"));
    expect(removed.tasks.map((task) => task.id)).toEqual(["a"]);
    expect(removeTask(removed, "b").ok).toBe(false);
  });

  it("refuse un titre vide, une date impossible et un identifiant repris", () => {
    const created = must(addTask(EMPTY_BOARD, { id: "a", title: "Courses", dateKey: "2026-11-18", priority: false }));
    expect(addTask(created, { id: "b", title: "   ", dateKey: "2026-11-18", priority: false }).ok).toBe(false);
    expect(addTask(created, { id: "b", title: "x".repeat(81), dateKey: "2026-11-18", priority: false }).ok).toBe(false);
    expect(addTask(created, { id: "b", title: "Valide", dateKey: "2026-02-31", priority: false }).ok).toBe(false);
    expect(addTask(created, { id: "a", title: "Autre", dateKey: "2026-11-18", priority: false }).ok).toBe(false);
    expect(addTask(created, { id: " ", title: "Autre", dateKey: "2026-11-18", priority: false }).ok).toBe(false);
    expect(toggleTask(created, "absente").ok).toBe(false);
  });

  it("fait sortir une habitude terminée de l’accueil", () => {
    const created = must(addHabit(EMPTY_BOARD, { id: "h", title: " Marche " }));
    expect(boardToHome(created, "2026-11-18").habits).toEqual(["Marche"]);
    const done = must(toggleHabit(created, "h"));
    expect(boardToHome(done, "2026-11-18").habits).toEqual([]);
    expect(toggleHabit(done, "absente").ok).toBe(false);
  });

  it("compte les objectifs du domaine", () => {
    const first = must(addGoal(EMPTY_BOARD, { id: "g1", title: "Dormir", domainId: "wellbeing" }));
    const second = must(addGoal(first, { id: "g2", title: "Lire", domainId: "personal" }));
    const third = must(addGoal(second, { id: "g3", title: "Nager", domainId: "wellbeing" }));
    expect(goalCounts(third)).toEqual({ wellbeing: 2, personal: 1 });
    expect(goalsInDomain(third, "wellbeing").map((goal) => goal.title)).toEqual(["Dormir", "Nager"]);
    expect(addGoal(third, { id: "g4", title: "x", domainId: "unknown" as GoalDomainId }).ok).toBe(false);
  });

  it("retient le prénom et borne le brouillon", () => {
    const named = must(setGivenName(EMPTY_BOARD, "  Léa  "));
    expect(greetingLine("Bonsoir", named.givenName)).toBe("Bonsoir, Léa");
    expect(clearGivenName(named).givenName).toBe("");
    expect(setGivenName(EMPTY_BOARD, "   ").ok).toBe(false);
    expect(setGivenName(EMPTY_BOARD, "a".repeat(41)).ok).toBe(false);

    const draft = writeDraft(EMPTY_BOARD, "a".repeat(450));
    expect(draft.draft).toHaveLength(400);
    expect(clearDraft(draft).draft).toBe("");
  });

  it("déplace, reporte et décale une tâche sans modifier la source", () => {
    const source = must(addTask(EMPTY_BOARD, { id: "a", title: "Courses", dateKey: "2026-11-20", priority: false }));
    const moved = must(moveTask(source, "a", "2026-11-21"));
    expect(source.tasks[0]?.dateKey).toBe("2026-11-20");
    expect(moved.tasks[0]?.dateKey).toBe("2026-11-21");
    expect(must(postponeTask(source, "a")).tasks[0]?.dateKey).toBe("2026-11-21");
    const shifted = must(shiftTaskMinutes(source, "a", 15, { hour: 9, minute: 0 }));
    expect(shifted.tasks[0]?.dueTime).toBe("09:15");
    const overnight = must(
      shiftTaskMinutes(
        must(addTask(EMPTY_BOARD, { id: "b", title: "Veille", dateKey: "2026-11-20", priority: false, dueTime: "23:50" })),
        "b",
        15,
        { hour: 0, minute: 0 },
      ),
    );
    expect(overnight.tasks[0]).toMatchObject({ dueTime: "00:05", dateKey: "2026-11-21" });
    expect(must(ignoreTask(source, "a")).tasks[0]?.ignoredOn).toBe("2026-11-20");
  });

  it("avance une tâche répétée au lieu de la laisser terminée", () => {
    expect(nextOccurrence("2026-11-20", "weekdays")).toBe("2026-11-23");
    expect(nextOccurrence("2026-11-20", "daily")).toBe("2026-11-21");
    const friday = must(
      addTask(EMPTY_BOARD, {
        id: "a",
        title: "Stand",
        dateKey: "2026-11-20",
        priority: false,
        recurrence: "weekdays",
      }),
    );
    const next = must(toggleTask(friday, "a"));
    expect(next.tasks[0]).toMatchObject({ dateKey: "2026-11-23", done: false, recurrence: "weekdays" });
  });
});
