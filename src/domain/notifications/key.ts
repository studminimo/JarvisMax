export const NOTIFICATION_KINDS = [
  "anticipatory",
  "primary",
  "follow_up",
  "confirmation",
  "overdue",
  "preparation",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

const TOKEN = /^[a-z0-9_-]{1,80}$/;
const FIRE_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export type NotificationKeyInput = {
  entityType: string;
  entityId: string;
  kind: NotificationKind;
  fireAt: string;
};

/** Identifiant stable d’une notification. Le planificateur de l’étape 4 s’appuie dessus pour éviter les doublons. */
export function notificationKey(input: NotificationKeyInput): string {
  if (!TOKEN.test(input.entityType) || !TOKEN.test(input.entityId)) {
    throw new Error("Identifiant de notification invalide");
  }
  if (!NOTIFICATION_KINDS.includes(input.kind)) {
    throw new Error("Type de notification inconnu");
  }
  if (!FIRE_AT.test(input.fireAt)) {
    throw new Error("Instant de notification invalide");
  }
  return `jarvis:${input.entityType}:${input.entityId}:${input.kind}:${input.fireAt}`;
}
