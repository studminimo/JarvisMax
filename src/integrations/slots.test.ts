import { INTEGRATION_IDS, integrationSlots } from "./slots";

describe("intégrations", () => {
  it("réserve les emplacements sans en brancher aucun", () => {
    expect([...INTEGRATION_IDS]).toEqual([
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
    ]);
    expect(integrationSlots.map((slot) => slot.id)).toEqual([...INTEGRATION_IDS]);
    expect(integrationSlots.every((slot) => slot.connected === false)).toBe(true);
  });
});
