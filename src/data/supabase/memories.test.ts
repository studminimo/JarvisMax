import { prepareMemory } from "@/domain/memory";
import { deleteMemory, loadMemories, memoryFromWrite, saveMemory, saveNewMemory, type MemoryStore } from "./memories";

const memory = memoryFromWrite("11111111-1111-4111-8111-111111111111", {
  content: "Préfère le matin",
  category: "preference",
  sensitive: false,
  origin: "user",
});

describe("souvenirs distants", () => {
  it("ne confirme l’écriture que si la ligne renvoyée est la même", async () => {
    const store: MemoryStore = {
      async list() {
        return { rows: [memory], failed: false };
      },
      async insert() {
        return { row: memory, failed: false };
      },
      async update() {
        return { row: memory, failed: false };
      },
      async remove() {
        return { removed: true, failed: false };
      },
    };
    expect(prepareMemory({ content: memory.content, category: memory.category, agreed: false }).ok).toBe(true);
    expect(await loadMemories(store, "user-1")).toEqual({ ok: true, value: [memory] });
    expect((await saveNewMemory(store, "user-1", memory)).ok).toBe(true);
    expect((await saveMemory(store, "user-1", memory)).ok).toBe(true);
    expect((await deleteMemory(store, "user-1", memory.id)).ok).toBe(true);

    const stale: MemoryStore = {
      ...store,
      async insert() {
        return { row: { ...memory, content: "Autre" }, failed: false };
      },
      async remove() {
        return { removed: false, failed: true };
      },
    };
    expect(await saveNewMemory(stale, "user-1", memory)).toEqual({
      ok: false,
      error: "Le serveur n’a pas répondu.",
    });
    expect(await deleteMemory(stale, "user-1", memory.id)).toEqual({
      ok: false,
      error: "Le serveur n’a pas répondu.",
    });
  });
});
