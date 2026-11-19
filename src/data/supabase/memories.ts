import type { SupabaseClient } from "@supabase/supabase-js";

import { memoryFromRow, sameMemory, type Memory, type MemoryWrite } from "@/domain/memory";
import { err, ok, type Result } from "@/domain/result";

const COLUMNS = "id, content, category, sensitive, origin";

export type MemoryStore = {
  list(userId: string): Promise<{ rows: Memory[] | null; failed: boolean }>;
  insert(userId: string, memory: Memory): Promise<{ row: Memory | null; failed: boolean }>;
  update(userId: string, memory: Memory): Promise<{ row: Memory | null; failed: boolean }>;
  remove(userId: string, id: string): Promise<{ removed: boolean; failed: boolean }>;
};

export async function loadMemories(store: MemoryStore, userId: string): Promise<Result<Memory[]>> {
  const listed = await store.list(userId);
  if (listed.failed || !listed.rows) {
    return err("Les souvenirs ne sont pas disponibles.");
  }
  return ok(listed.rows);
}

export async function saveNewMemory(store: MemoryStore, userId: string, memory: Memory): Promise<Result<Memory>> {
  const inserted = await store.insert(userId, memory);
  if (inserted.failed || !inserted.row || !sameMemory(inserted.row, memory)) {
    return err("Le serveur n’a pas répondu.");
  }
  return ok(inserted.row);
}

export async function saveMemory(store: MemoryStore, userId: string, memory: Memory): Promise<Result<Memory>> {
  const updated = await store.update(userId, memory);
  if (updated.failed || !updated.row || !sameMemory(updated.row, memory)) {
    return err("Le serveur n’a pas répondu.");
  }
  return ok(updated.row);
}

export async function deleteMemory(store: MemoryStore, userId: string, id: string): Promise<Result<string>> {
  const removed = await store.remove(userId, id);
  if (removed.failed || !removed.removed) {
    return err("Le serveur n’a pas répondu.");
  }
  return ok(id);
}

export function memoryFromWrite(id: string, write: MemoryWrite): Memory {
  return { id, ...write };
}

function readRow(value: unknown): Memory | null {
  return memoryFromRow(value);
}

export function supabaseMemoryStore(supabase: SupabaseClient): MemoryStore {
  return {
    async list(userId) {
      const { data, error } = await supabase
        .from("memories")
        .select(COLUMNS)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error || !Array.isArray(data)) {
        return { rows: null, failed: true };
      }
      const rows = data.map(readRow);
      if (rows.some((row) => row === null)) {
        return { rows: null, failed: true };
      }
      return { rows: rows.filter((row): row is Memory => row !== null), failed: false };
    },
    async insert(userId, memory) {
      const { data, error } = await supabase
        .from("memories")
        .insert({ ...toWrite(memory), user_id: userId })
        .select(COLUMNS)
        .maybeSingle();
      if (error) {
        return { row: null, failed: true };
      }
      return { row: readRow(data), failed: false };
    },
    async update(userId, memory) {
      const { data, error } = await supabase
        .from("memories")
        .update({ content: memory.content, category: memory.category, sensitive: memory.sensitive })
        .eq("user_id", userId)
        .eq("id", memory.id)
        .select(COLUMNS)
        .maybeSingle();
      if (error) {
        return { row: null, failed: true };
      }
      return { row: readRow(data), failed: false };
    },
    async remove(userId, id) {
      const { data, error } = await supabase.from("memories").delete().eq("user_id", userId).eq("id", id).select("id");
      if (error || !Array.isArray(data) || data.length === 0) {
        return { removed: false, failed: true };
      }
      return { removed: true, failed: false };
    },
  };
}

function toWrite(memory: Memory) {
  return {
    id: memory.id,
    content: memory.content,
    category: memory.category,
    sensitive: memory.sensitive,
    origin: memory.origin,
  };
}
