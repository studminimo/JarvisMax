import { describeHome, EMPTY_HOME } from "./home";

describe("accueil", () => {
  it("décrit un quotidien encore vide", () => {
    expect(describeHome(EMPTY_HOME)).toEqual({
      nextTask: { filled: false, text: "Aucune tâche enregistrée." },
      day: { filled: false, text: "Rien au planning." },
      priorities: { items: [], emptyLabel: "Aucune priorité retenue." },
      habits: { items: [], emptyLabel: "Aucune habitude à accomplir." },
      progress: { filled: false, text: "Aucune action enregistrée pour aujourd’hui." },
    });
  });

  it("reprend les éléments réellement fournis", () => {
    const copy = describeHome({
      nextTaskTitle: "  Appeler le médecin  ",
      dayCount: 2,
      priorities: ["Famille", " "],
      habits: ["Marche"],
      completedCount: 1,
      totalCount: 3,
    });

    expect(copy.nextTask).toEqual({ filled: true, text: "Appeler le médecin" });
    expect(copy.day).toEqual({ filled: true, text: "2 éléments au planning." });
    expect(copy.priorities.items).toEqual(["Famille"]);
    expect(copy.habits.items).toEqual(["Marche"]);
    expect(copy.progress).toEqual({ filled: true, text: "1 sur 3 terminées." });
  });

  it("accorde le singulier", () => {
    const copy = describeHome({
      ...EMPTY_HOME,
      dayCount: 1,
      completedCount: 1,
      totalCount: 1,
    });
    expect(copy.day.text).toBe("1 élément au planning.");
    expect(copy.progress.text).toBe("1 sur 1 terminée.");
  });

  it("refuse une progression incohérente", () => {
    expect(() => describeHome({ ...EMPTY_HOME, completedCount: 2, totalCount: 1 })).toThrow(
      "Progression incohérente",
    );
  });
});
