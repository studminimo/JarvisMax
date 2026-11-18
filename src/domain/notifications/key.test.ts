import { NOTIFICATION_KINDS, notificationKey } from "./key";

const base = {
  entityType: "task",
  entityId: "123e4567-e89b-12d3-a456-426614174000",
  kind: "primary" as const,
  fireAt: "2026-11-18T09:00:00Z",
};

describe("clé de notification", () => {
  it("reste stable pour les mêmes paramètres", () => {
    const key = notificationKey(base);
    expect(key).toBe(
      "jarvis:task:123e4567-e89b-12d3-a456-426614174000:primary:2026-11-18T09:00:00Z",
    );
    expect(notificationKey(base)).toBe(key);
  });

  it("change quand le type change", () => {
    expect(notificationKey({ ...base, kind: "overdue" })).not.toBe(notificationKey(base));
  });

  it("n’accepte qu’un instant UTC à la seconde", () => {
    expect(() => notificationKey({ ...base, fireAt: "2026-11-18T10:00:00+01:00" })).toThrow(
      "Instant de notification invalide",
    );
    expect(() => notificationKey({ ...base, fireAt: "2026-11-18T09:00:00.000Z" })).toThrow(
      "Instant de notification invalide",
    );
  });

  it("expose les six familles prévues", () => {
    expect(NOTIFICATION_KINDS).toEqual([
      "anticipatory",
      "primary",
      "follow_up",
      "confirmation",
      "overdue",
      "preparation",
    ]);
  });
});
