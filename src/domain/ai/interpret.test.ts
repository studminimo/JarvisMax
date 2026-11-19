import { AI_TOOL_NAMES } from "./tools";
import { completionWrite, composeRange, interpretTool, sameStoredTask, toolDefinitions, type StoredTask } from "./interpret";

const TODAY = "2026-11-19";
const TASK_ID = "11111111-1111-4111-8111-111111111111";

describe("interprétation des outils", () => {
  it("pose une question au lieu d’écrire quand le titre, le jour ou l’heure manque", () => {
    expect(interpretTool("create_task", { date: TODAY }, TODAY)).toEqual({ kind: "question", question: "Quel est le titre ?" });
    expect(interpretTool("create_task", { title: "Appeler" }, TODAY)).toEqual({ kind: "question", question: "Quel jour ?" });
    expect(interpretTool("create_reminder", { title: "Appeler", date: "demain" }, TODAY)).toEqual({ kind: "question", question: "À quelle heure ?" });
    expect(interpretTool("create_task", { title: "Appeler", date: TODAY, time: "25:00" }, TODAY)).toEqual({ kind: "question", question: "À quelle heure ?" });
  });

  it("prépare une tâche seulement avec un titre, un jour et une heure valides", () => {
    expect(interpretTool("create_task", { title: "  Appeler  ", date: "aujourd’hui", time: "09:00:00", priority: true }, TODAY)).toEqual({
      kind: "create_task",
      task: { title: "Appeler", dateKey: TODAY, dueTime: "09:00", priority: true, context: "", recurrence: "none" },
    });
    expect(interpretTool("create_recurring_reminder", { title: "Sport", time: "07:30", recurrence: "jours ouvrés" }, TODAY)).toEqual({
      kind: "create_task",
      task: { title: "Sport", dateKey: TODAY, dueTime: "07:30", priority: false, context: "", recurrence: "weekdays" },
    });
  });

  it("demande la tâche ou le changement avant une modification", () => {
    expect(interpretTool("complete_task", {}, TODAY)).toEqual({ kind: "question", question: "Quelle tâche ?" });
    expect(interpretTool("reschedule_task", { id: TASK_ID }, TODAY)).toEqual({ kind: "question", question: "Quel jour, ou quelle heure ?" });
    expect(interpretTool("update_task", { id: TASK_ID }, TODAY)).toEqual({ kind: "question", question: "Que faut-il modifier ?" });
    expect(interpretTool("delete_task", { id: TASK_ID }, TODAY)).toEqual({ kind: "delete_task", id: TASK_ID });
  });

  it("exige un accord explicite pour une mémoire sensible", () => {
    expect(interpretTool("save_memory", { content: "Allergique aux arachides", category: "santé" }, TODAY)).toEqual({
      kind: "question",
      question: "Tu confirmes d’enregistrer cette information sensible ?",
    });
    expect(interpretTool("save_memory", { content: "Allergique aux arachides", category: "santé", agreed: true }, TODAY)).toEqual({
      kind: "save_memory",
      content: "Allergique aux arachides",
      category: "health",
      sensitive: true,
      origin: "user",
    });
    expect(interpretTool("save_memory", { content: "Préfère le matin", category: "préférence" }, TODAY)).toMatchObject({
      kind: "save_memory",
      category: "preference",
      sensitive: false,
    });
  });

  it("prépare une routine et un objectif, et demande ce qui manque", () => {
    expect(interpretTool("create_routine", { title: "Matin" }, TODAY)).toEqual({ kind: "question", question: "Quelles étapes ?" });
    expect(interpretTool("create_routine", { title: "Matin", steps: ["Eau", "Fenêtre"], recurrence: "jours ouvrés" }, TODAY)).toEqual({
      kind: "create_routine",
      title: "Matin",
      dueTime: null,
      recurrence: "weekdays",
      steps: ["Eau", "Fenêtre"],
    });
    expect(interpretTool("create_goal", { title: "Lire" }, TODAY)).toEqual({ kind: "question", question: "Quel domaine ?" });
    expect(interpretTool("create_goal", { title: "Lire", domain: "loisirs" }, TODAY)).toEqual({
      kind: "create_goal",
      title: "Lire",
      domain: "leisure",
    });
    expect(interpretTool("update_goal", { id: TASK_ID }, TODAY)).toEqual({ kind: "question", question: "Que faut-il modifier ?" });
    expect(interpretTool("drop_table", {}, TODAY)).toEqual({ kind: "unavailable", message: "Cet outil n’existe pas." });
    expect(interpretTool("generate_daily_plan", { date: "demain" }, TODAY)).toEqual({ kind: "compose", scope: "day", dateKey: "2026-11-20" });
    expect(interpretTool("generate_weekly_review", {}, TODAY)).toEqual({ kind: "compose", scope: "week", dateKey: TODAY });
    expect(toolDefinitions().map((tool) => tool.function.name)).toEqual([...AI_TOOL_NAMES]);
  });

  it("avance une répétition sans la marquer terminée", () => {
    const task: StoredTask = {
      id: TASK_ID,
      title: "Sport",
      dateKey: "2026-11-20",
      dueTime: "07:30",
      done: false,
      priority: false,
      context: "",
      recurrence: "weekdays",
      ignoredOn: "2026-11-20",
    };
    const next = completionWrite(task);
    expect(next).toEqual({ done: false, dateKey: "2026-11-23", ignoredOn: null });
    expect(sameStoredTask({ ...task, ...next }, { ...task, done: false, dateKey: "2026-11-23", ignoredOn: null })).toBe(true);
    expect(composeRange("week", TODAY)).toEqual({ from: TODAY, to: "2026-11-25" });
  });
});
