import { EMPTY_BOARD, addTask } from "@/domain/board";
import { deleteTask, loadTasks, saveNewTask, type TaskStore } from "./tasks";

function must<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

describe("tâches distantes", () => {
  const task = must(
    addTask(EMPTY_BOARD, { id: "task-1", title: "Appeler", dateKey: "2026-11-19", priority: true, dueTime: "09:00" }),
  ).tasks[0];

  it("ne confirme l’ajout que si la ligne renvoyée est la même", async () => {
    const store: TaskStore = {
      async list() {
        return { rows: [task], failed: false };
      },
      async insert() {
        return { row: task, failed: false };
      },
      async update() {
        return { row: null, failed: true };
      },
      async remove() {
        return { removed: false, failed: true };
      },
    };
    expect(await loadTasks(store, "user-1")).toEqual({ ok: true, value: [task] });
    expect((await saveNewTask(store, "user-1", task)).ok).toBe(true);

    const stale: TaskStore = {
      ...store,
      async insert() {
        return { row: { ...task, title: "Autre" }, failed: false };
      },
    };
    expect(await saveNewTask(stale, "user-1", task)).toEqual({
      ok: false,
      error: "Le serveur n’a pas répondu.",
    });
    expect(await deleteTask(store, "user-1", task.id).then((result) => result.ok)).toBe(false);
  });
});
