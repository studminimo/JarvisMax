export type HomeSnapshot = {
  nextTaskTitle: string | null;
  dayCount: number;
  priorities: readonly string[];
  habits: readonly string[];
  completedCount: number;
  totalCount: number;
};

export const EMPTY_HOME: HomeSnapshot = {
  nextTaskTitle: null,
  dayCount: 0,
  priorities: [],
  habits: [],
  completedCount: 0,
  totalCount: 0,
};

export type TextLine = {
  filled: boolean;
  text: string;
};

export type ListLine = {
  items: readonly string[];
  emptyLabel: string;
};

export type HomeCopy = {
  nextTask: TextLine;
  day: TextLine;
  priorities: ListLine;
  habits: ListLine;
  progress: TextLine;
};

function assertCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} invalide`);
  }
}

function cleanList(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

export function describeHome(snapshot: HomeSnapshot): HomeCopy {
  assertCount(snapshot.dayCount, "Planning");
  assertCount(snapshot.completedCount, "Progression");
  assertCount(snapshot.totalCount, "Progression");
  if (snapshot.completedCount > snapshot.totalCount) {
    throw new Error("Progression incohérente");
  }

  const nextTitle = snapshot.nextTaskTitle?.trim() ?? "";
  const priorities = cleanList(snapshot.priorities);
  const habits = cleanList(snapshot.habits);
  const progressWord = snapshot.totalCount > 1 ? "terminées" : "terminée";

  return {
    nextTask: {
      filled: nextTitle.length > 0,
      text: nextTitle.length > 0 ? nextTitle : "Aucune tâche enregistrée.",
    },
    day: {
      filled: snapshot.dayCount > 0,
      text:
        snapshot.dayCount === 0
          ? "Rien au planning."
          : snapshot.dayCount === 1
            ? "1 élément au planning."
            : `${snapshot.dayCount} éléments au planning.`,
    },
    priorities: {
      items: priorities,
      emptyLabel: "Aucune priorité retenue.",
    },
    habits: {
      items: habits,
      emptyLabel: "Aucune habitude à accomplir.",
    },
    progress: {
      filled: snapshot.totalCount > 0,
      text:
        snapshot.totalCount === 0
          ? "Aucune action enregistrée pour aujourd’hui."
          : `${snapshot.completedCount} sur ${snapshot.totalCount} ${progressWord}.`,
    },
  };
}
