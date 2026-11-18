import { GOAL_DOMAINS, goalSummary } from "./goals";

describe("objectifs", () => {
  it("couvre les sept domaines de vie", () => {
    expect(GOAL_DOMAINS.map((domain) => domain.id)).toEqual([
      "personal",
      "habits",
      "family",
      "couple",
      "wellbeing",
      "work",
      "leisure",
    ]);
    expect(new Set(GOAL_DOMAINS.map((domain) => domain.label)).size).toBe(GOAL_DOMAINS.length);
  });

  it("résume un nombre d’objectifs", () => {
    expect(goalSummary(0)).toBe("Aucun objectif");
    expect(goalSummary(1)).toBe("1 objectif");
    expect(goalSummary(4)).toBe("4 objectifs");
    expect(() => goalSummary(-1)).toThrow("Nombre d’objectifs invalide");
  });
});
