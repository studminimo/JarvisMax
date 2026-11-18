export const INTEGRATION_IDS = [
  "voice_input",
  "speech_output",
  "external_calendar",
  "location",
  "contextual_reminders",
  "shopping_lists",
  "photo_import",
  "documents",
  "journal",
  "timer",
  "rewards",
  "widgets",
  "shortcuts",
] as const;

export type IntegrationId = (typeof INTEGRATION_IDS)[number];

export type IntegrationSlot = {
  id: IntegrationId;
  connected: false;
};

/** Emplacements réservés. Aucun n’est exposé dans l’interface tant qu’il n’est pas livré. */
export const integrationSlots: readonly IntegrationSlot[] = INTEGRATION_IDS.map((id) => ({
  id,
  connected: false as const,
}));
