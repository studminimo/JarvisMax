import { memoryFromRow, prepareMemory, sameMemory } from "./memory";

const ID = "11111111-1111-4111-8111-111111111111";

describe("mémoire", () => {
  it("exige un accord avant d’écrire une catégorie sensible", () => {
    expect(prepareMemory({ content: "  Allergique aux arachides  ", category: "health", agreed: false })).toEqual({
      ok: false,
      error: "Tu confirmes d’enregistrer cette information sensible ?",
    });
    expect(prepareMemory({ content: "Allergique aux arachides", category: "health", agreed: true })).toEqual({
      ok: true,
      value: {
        content: "Allergique aux arachides",
        category: "health",
        sensitive: true,
        origin: "user",
      },
    });
  });

  it("enregistre une préférence sans accord", () => {
    expect(prepareMemory({ content: "Préfère le matin", category: "preference", agreed: false }).ok).toBe(true);
    expect(prepareMemory({ content: "   ", category: "fact", agreed: true })).toEqual({
      ok: false,
      error: "Le souvenir est vide.",
    });
  });

  it("refuse une ligne dont la sensibilité ne correspond pas à la catégorie", () => {
    const row = {
      id: ID,
      content: "Préfère le matin",
      category: "preference",
      sensitive: false,
      origin: "user",
    };
    const memory = memoryFromRow(row);
    expect(memory).toEqual({ ...row, id: ID });
    expect(memoryFromRow({ ...row, sensitive: true })).toBeNull();
    expect(memoryFromRow({ ...row, category: "health", sensitive: false })).toBeNull();
    if (memory) {
      expect(sameMemory(memory, memory)).toBe(true);
    }
  });
});
