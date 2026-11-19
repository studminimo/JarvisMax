import { GOAL_DOMAINS, type GoalDomainId } from "./goals";
import { err, ok, type Result } from "./result";

export const COACH_MODES = ["normal", "overwhelmed", "focus", "play", "family", "prepare", "away"] as const;

export type CoachMode = (typeof COACH_MODES)[number];

export const COACH_LABELS: Record<CoachMode, string> = {
  normal: "Normal",
  overwhelmed: "Débordé",
  focus: "Concentration",
  play: "Jeu",
  family: "Famille",
  prepare: "Préparation",
  away: "Absence",
};

export type HomeCard = "next" | "day" | "priorities" | "habits" | "progress";

const TITLE_LIMIT = 80;
const STEP_LIMIT = 8;

export type RoutineStep = {
  id: string;
  title: string;
  position: number;
  doneOn: string | null;
};

export type Routine = {
  id: string;
  title: string;
  dueTime: string | null;
  recurrence: "none" | "daily" | "weekdays";
  steps: RoutineStep[];
};

export type RoutineDraft = {
  title: string;
  dueTime: string | null;
  recurrence: "none" | "daily" | "weekdays";
  steps: string[];
};

export function isCoachMode(value: string): value is CoachMode {
  return (COACH_MODES as readonly string[]).includes(value);
}

export function coachLine(mode: CoachMode): string {
  if (mode === "overwhelmed") {
    return "Une seule action. Le reste attend.";
  }
  if (mode === "focus") {
    return "Le reste est rangé.";
  }
  if (mode === "play") {
    return "Léger. Une action, puis une habitude.";
  }
  if (mode === "family") {
    return "Ce qui concerne aujourd’hui.";
  }
  if (mode === "prepare") {
    return "Ce qu’il faut avoir fini avant de partir.";
  }
  if (mode === "away") {
    return "Tu es absent. Seule une priorité reste visible.";
  }
  return "Tout est visible.";
}

export function homeCards(mode: CoachMode): readonly HomeCard[] {
  if (mode === "overwhelmed" || mode === "away") {
    return ["next"];
  }
  if (mode === "focus" || mode === "family") {
    return ["next", "day"];
  }
  if (mode === "play") {
    return ["next", "habits"];
  }
  if (mode === "prepare") {
    return ["next", "priorities"];
  }
  return ["next", "day", "priorities", "habits", "progress"];
}

export function showsTimer(mode: CoachMode): boolean {
  return mode === "normal" || mode === "focus" || mode === "prepare";
}

export function showsRoutine(mode: CoachMode): boolean {
  return mode === "normal" || mode === "prepare" || mode === "family";
}

export function priorityOnly(mode: CoachMode): boolean {
  return mode === "away" || mode === "prepare";
}

export function prepareRoutine(input: {
  title: string;
  dueTime?: string | null;
  recurrence?: string;
  steps: readonly string[];
}): Result<RoutineDraft> {
  const title = input.title.trim();
  if (title.length < 1 || title.length > TITLE_LIMIT) {
    return err("Quel est le titre ?");
  }
  const steps = input.steps.map((step) => step.trim()).filter((step) => step.length > 0);
  if (steps.length < 1) {
    return err("Quelles étapes ?");
  }
  if (steps.length > STEP_LIMIT || steps.some((step) => step.length > TITLE_LIMIT)) {
    return err("Huit étapes maximum, quatre-vingts caractères chacune.");
  }
  const recurrence = input.recurrence ?? "daily";
  if (recurrence !== "none" && recurrence !== "daily" && recurrence !== "weekdays") {
    return err("Quelle répétition ?");
  }
  const dueTime = input.dueTime ?? null;
  if (dueTime !== null && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) {
    return err("À quelle heure ?");
  }
  return ok({ title, dueTime, recurrence, steps });
}

export function prepareGoal(input: { title: string; domain: string }): Result<{ title: string; domain: GoalDomainId }> {
  const title = input.title.trim();
  if (title.length < 1 || title.length > TITLE_LIMIT) {
    return err("Quel est le titre ?");
  }
  const found = GOAL_DOMAINS.find((domain) => domain.id === input.domain);
  if (!found) {
    return err("Quel domaine ?");
  }
  return ok({ title, domain: found.id });
}

export function prepareNote(content: string): Result<string> {
  const text = content.trim();
  if (text.length < 1) {
    return err("La note est vide.");
  }
  if (text.length > 400) {
    return err("400 caractères maximum.");
  }
  return ok(text);
}

export function domainFromText(value: string): GoalDomainId | null {
  const text = value.trim().toLowerCase();
  const aliases: Record<string, GoalDomainId> = {
    personal: "personal",
    personnel: "personal",
    habits: "habits",
    habitude: "habits",
    habitudes: "habits",
    family: "family",
    famille: "family",
    couple: "couple",
    wellbeing: "wellbeing",
    "bien-être": "wellbeing",
    "bien etre": "wellbeing",
    sante: "wellbeing",
    santé: "wellbeing",
    work: "work",
    travail: "work",
    leisure: "leisure",
    loisir: "leisure",
    loisirs: "leisure",
  };
  return aliases[text] ?? null;
}
