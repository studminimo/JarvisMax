/** Noms d’outils. L’application ne les exécute pas : la fonction Edge `chat` les interprète. */
export const AI_TOOL_NAMES = [
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
] as const;

export type AiToolName = (typeof AI_TOOL_NAMES)[number];
