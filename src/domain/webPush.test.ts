import { isDuePush, PUSH_GRACE_MS } from "./reminders";
import { webReminderGate } from "./webPush";

describe("rappels du site", () => {
  it("demande l’écran d’accueil sur iPhone, puis l’autorisation", () => {
    expect(
      webReminderGate({
        pushSupported: true,
        configured: true,
        ios: true,
        installed: false,
        permission: "default",
        subscribed: false,
      }),
    ).toBe("install");
    expect(
      webReminderGate({
        pushSupported: true,
        configured: true,
        ios: true,
        installed: true,
        permission: "granted",
        subscribed: true,
      }),
    ).toBe("subscribed");
    expect(
      webReminderGate({
        pushSupported: true,
        configured: false,
        ios: false,
        installed: true,
        permission: "default",
        subscribed: false,
      }),
    ).toBe("unconfigured");
  });

  it("envoie un rappel pendant quinze minutes après l’heure", () => {
    const fireAt = "2026-11-19T08:00:00Z";
    const at = Date.parse(fireAt);
    expect(isDuePush(fireAt, at)).toBe(true);
    expect(isDuePush(fireAt, at + PUSH_GRACE_MS)).toBe(true);
    expect(isDuePush(fireAt, at + PUSH_GRACE_MS + 1)).toBe(false);
    expect(isDuePush(fireAt, at - 1)).toBe(false);
  });
});
