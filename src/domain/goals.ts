export const GOAL_DOMAINS = [
  { id: "personal", label: "Personnel" },
  { id: "habits", label: "Habitudes" },
  { id: "family", label: "Famille" },
  { id: "couple", label: "Couple" },
  { id: "wellbeing", label: "Bien-être" },
  { id: "work", label: "Travail" },
  { id: "leisure", label: "Loisirs" },
] as const;

export type GoalDomainId = (typeof GOAL_DOMAINS)[number]["id"];

export function goalSummary(count: number): string {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Nombre d’objectifs invalide");
  }
  if (count === 0) {
    return "Aucun objectif";
  }
  if (count === 1) {
    return "1 objectif";
  }
  return `${count} objectifs`;
}
