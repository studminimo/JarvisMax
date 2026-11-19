import { buildMonthGrid, buildWeek, entriesOnDate, shiftView, type CalendarView } from "./calendar";

describe("calendrier", () => {
  it("aligne novembre 2026 sur le lundi 26 octobre", () => {
    const cells = buildMonthGrid("2026-11-18", "2026-11-18");
    expect(cells).toHaveLength(42);
    expect(cells[0]).toMatchObject({ dateKey: "2026-10-26", inCurrentMonth: false, isToday: false });
    expect(cells[6]).toMatchObject({ dateKey: "2026-11-01", inCurrentMonth: true, dayOfMonth: 1 });
    expect(cells.find((cell) => cell.dateKey === "2026-11-18")).toMatchObject({ isToday: true });
    expect(cells[41]).toMatchObject({ dateKey: "2026-12-06", inCurrentMonth: false });
  });

  it("ouvre la semaine le lundi, y compris depuis un dimanche", () => {
    expect(buildWeek("2026-11-22", "2026-11-18").map((cell) => cell.dateKey)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
  });

  it("décale le jour, la semaine et le mois", () => {
    expect(shiftView("2026-11-18", "day", -1)).toBe("2026-11-17");
    expect(shiftView("2026-11-18", "week", 1)).toBe("2026-11-25");
    expect(shiftView("2026-01-31", "month", 1)).toBe("2026-02-28");
    expect(() => shiftView("2026-11-18", "day", 2 as -1)).toThrow("Décalage invalide");
    expect(() => shiftView("2026-11-18", "year" as CalendarView, 1)).toThrow("Vue invalide");
  });

  it("filtre les entrées du jour sans modifier la liste source", () => {
    const entries = [
      { id: "1", title: "Courses", dateKey: "2026-11-18" },
      { id: "2", title: "Médecin", dateKey: "2026-11-19" },
    ];
    expect(entriesOnDate(entries, "2026-11-18")).toEqual([entries[0]]);
    expect(entriesOnDate(entries, "2026-11-20")).toEqual([]);
    expect(entries).toHaveLength(2);
  });
});
