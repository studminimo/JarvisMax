import { AI_TOOL_NAMES } from "./tools";

describe("outils IA", () => {
  it("fixe le contrat d’actions, sans les exécuter ici", () => {
    expect([...AI_TOOL_NAMES]).toEqual([
      "create_task",
      "update_task",
      "delete_task",
      "create_reminder",
      "create_recurring_reminder",
      "reschedule_task",
      "complete_task",
      "create_routine",
      "create_goal",
      "update_goal",
      "get_daily_schedule",
      "get_pending_tasks",
      "search_memory",
      "save_memory",
      "generate_daily_plan",
      "generate_weekly_review",
    ]);
    expect(new Set(AI_TOOL_NAMES).size).toBe(AI_TOOL_NAMES.length);
  });
});
