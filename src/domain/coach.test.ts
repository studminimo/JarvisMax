import { coachLine, homeCards, prepareGoal, prepareNote, prepareRoutine, priorityOnly, showsRoutine, showsTimer } from "./coach";

describe("coach", () => {
  it("ne montre qu’une action quand la personne est débordée", () => {
    expect(homeCards("overwhelmed")).toEqual(["next"]);
    expect(coachLine("overwhelmed")).toBe("Une seule action. Le reste attend.");
    expect(homeCards("normal")).toEqual(["next", "day", "priorities", "habits", "progress"]);
    expect(showsTimer("focus")).toBe(true);
    expect(showsTimer("overwhelmed")).toBe(false);
    expect(showsRoutine("family")).toBe(true);
    expect(priorityOnly("away")).toBe(true);
  });

  it("demande les étapes d’une routine et le domaine d’un objectif", () => {
    expect(prepareRoutine({ title: "Matin", steps: [] })).toEqual({ ok: false, error: "Quelles étapes ?" });
    expect(prepareRoutine({ title: "Matin", steps: ["Eau", "Fenêtre"], recurrence: "weekdays" })).toEqual({
      ok: true,
      value: { title: "Matin", dueTime: null, recurrence: "weekdays", steps: ["Eau", "Fenêtre"] },
    });
    expect(prepareGoal({ title: "Lire", domain: "nope" })).toEqual({ ok: false, error: "Quel domaine ?" });
    expect(prepareGoal({ title: "Lire", domain: "leisure" }).ok).toBe(true);
    expect(prepareNote("   ")).toEqual({ ok: false, error: "La note est vide." });
  });
});
