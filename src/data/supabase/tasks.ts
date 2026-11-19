import type { SupabaseClient } from "@supabase/supabase-js";

import { type BoardTask } from "@/domain/board";
import { taskFromRow } from "@/domain/reminders";
import { err, ok, type Result } from "@/domain/result";

const COLUMNS = "id, title, date_key, due_time, done, priority, context, recurrence, ignored_on";

export type TaskStore = {
  list(userId: string): Promise<{ rows: BoardTask[] | null; failed: boolean }>;
  insert(userId: string, task: BoardTask): Promise<{ row: BoardTask | null; failed: boolean }>;
  update(userId: string, task: BoardTask): Promise<{ row: BoardTask | null; failed: boolean }>;
  remove(userId: string, id: string): Promise<{ removed: boolean; failed: boolean }>;
};

function sameTask(left: BoardTask, right: BoardTask): boolean {
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

export async function loadTasks(store: TaskStore, userId: string): Promise<Result<BoardTask[]>> {
  const listed = await store.list(userId);
  if (listed.failed || !listed.rows) {
    return err("Les tâches ne sont pas disponibles.");
  }
  return ok(listed.rows);
}

export async function saveNewTask(store: TaskStore, userId: string, task: BoardTask): Promise<Result<BoardTask>> {
  const inserted = await store.insert(userId, task);
  if (inserted.failed || !inserted.row || !sameTask(inserted.row, task)) {
    return err("Le serveur n’a pas répondu.");
  }
  return ok(inserted.row);
}

export async function saveTask(store: TaskStore, userId: string, task: BoardTask): Promise<Result<BoardTask>> {
  const updated = await store.update(userId, task);
  if (updated.failed || !updated.row || !sameTask(updated.row, task)) {
    return err("Le serveur n’a pas répondu.");
  }
  return ok(updated.row);
}

export async function deleteTask(store: TaskStore, userId: string, id: string): Promise<Result<string>> {
  const removed = await store.remove(userId, id);
  if (removed.failed || !removed.removed) {
    return err("Le serveur n’a pas répondu.");
  }
  return ok(id);
}

function toWrite(task: BoardTask) {
  return {
    id: task.id,
    title: task.title,
    date_key: task.dateKey,
    due_time: task.dueTime,
    done: task.done,
    priority: task.priority,
    context: task.context,
    recurrence: task.recurrence,
    ignored_on: task.ignoredOn,
  };
}

function readRow(value: unknown): BoardTask | null {
  const parsed = taskFromRow(value);
  return parsed.ok ? parsed.value : null;
}

export function supabaseTaskStore(supabase: SupabaseClient): TaskStore {
  return {
    async list(userId) {
      const { data, error } = await supabase.from("tasks").select(COLUMNS).eq("user_id", userId);
      if (error || !Array.isArray(data)) {
        return { rows: null, failed: true };
      }
      const rows = data.map(readRow);
      if (rows.some((row) => row === null)) {
        return { rows: null, failed: true };
      }
      return { rows: rows.filter((row): row is BoardTask => row !== null), failed: false };
    },
    async insert(userId, task) {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...toWrite(task), user_id: userId })
        .select(COLUMNS)
        .maybeSingle();
      if (error) {
        return { row: null, failed: true };
      }
      return { row: readRow(data), failed: false };
    },
    async update(userId, task) {
      const { data, error } = await supabase
        .from("tasks")
        .update(toWrite(task))
        .eq("user_id", userId)
        .eq("id", task.id)
        .select(COLUMNS)
        .maybeSingle();
      if (error) {
        return { row: null, failed: true };
      }
      return { row: readRow(data), failed: false };
    },
    async remove(userId, id) {
      const { data, error } = await supabase.from("tasks").delete().eq("user_id", userId).eq("id", id).select("id");
      if (error || !Array.isArray(data) || data.length === 0) {
        return { removed: false, failed: true };
      }
      return { removed: true, failed: false };
    },
  };
}
