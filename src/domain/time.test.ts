import {
  addDays,
  addMonths,
  formatClock,
  formatLongDate,
  formatMonthTitle,
  formatWeekTitle,
  greetingForHour,
  parseDateKey,
  startOfWeek,
  weekdayIndexMonday,
  zonedDateKey,
  zonedInstant,
  zonedParts,
} from "./time";

describe("temps", () => {
  it("reconnaît le mercredi 18 novembre 2026 comme milieu de semaine", () => {
    expect(weekdayIndexMonday("2026-11-18")).toBe(2);
    expect(startOfWeek("2026-11-18")).toBe("2026-11-16");
  });

  it("fait passer les mois et les années bissextiles", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("décale d’un mois en bornant le jour", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(() => addMonths("2026-11-18", 1.5)).toThrow("Décalage invalide");
  });

  it("refuse une date impossible", () => {
    expect(() => parseDateKey("2026-02-31")).toThrow("Date invalide");
  });

  it("convertit un instant UTC vers Paris", () => {
    const evening = new Date("2026-11-18T22:30:00Z");
    expect(zonedParts(evening)).toMatchObject({ hour: 23, minute: 30, day: 18 });
    expect(zonedDateKey(evening)).toBe("2026-11-18");
    expect(formatClock(new Date("2026-11-18T10:05:00Z"))).toBe("11:05");

    const afterMidnight = new Date("2026-11-18T23:30:00Z");
    expect(zonedParts(afterMidnight).hour).toBe(0);
    expect(zonedDateKey(afterMidnight)).toBe("2026-11-19");
  });

  it("salue selon l’heure civile", () => {
    expect(greetingForHour(4)).toBe("Bonsoir");
    expect(greetingForHour(5)).toBe("Bonjour");
    expect(greetingForHour(11)).toBe("Bonjour");
    expect(greetingForHour(12)).toBe("Bon après-midi");
    expect(greetingForHour(17)).toBe("Bon après-midi");
    expect(greetingForHour(18)).toBe("Bonsoir");
    expect(() => greetingForHour(24)).toThrow("Heure invalide");
  });

  it("écrit la date, le mois et la semaine en français", () => {
    expect(formatLongDate("2026-11-18")).toMatch(/^Mercredi\b/);
    expect(formatLongDate("2026-11-18").toLowerCase()).toContain("novembre");
    expect(formatMonthTitle("2026-11-18")).toMatch(/^Novembre\b/);
    expect(formatMonthTitle("2026-11-18")).toContain("2026");

    const sameMonth = formatWeekTitle("2026-11-18").toLowerCase();
    expect(sameMonth).toContain("16");
    expect(sameMonth).toContain("22");
    expect(sameMonth).toContain("2026");

    const acrossMonths = formatWeekTitle("2026-11-01").toLowerCase();
    expect(acrossMonths).toContain("oct");
    expect(acrossMonths).toContain("nov");
  });

  it("place une heure civile de Paris sur l’instant UTC", () => {
    expect(zonedInstant("2026-11-19", "07:00").toISOString()).toBe("2026-11-19T06:00:00.000Z");
    expect(zonedInstant("2026-07-19", "07:00").toISOString()).toBe("2026-07-19T05:00:00.000Z");
    expect(() => zonedInstant("2026-11-19", "25:00")).toThrow("Heure invalide");
  });
});
