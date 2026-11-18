import { addDays, parseDateKey, startOfWeek } from "./time";

export type CalendarView = "day" | "week" | "month";

export type CalendarCell = {
  dateKey: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
};

export type DatedEntry = {
  id: string;
  title: string;
  dateKey: string;
};

export const WEEKDAY_LABELS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."] as const;

function toCell(dateKey: string, month: number, year: number, todayKey: string): CalendarCell {
  const parsed = parseDateKey(dateKey);
  return {
    dateKey,
    dayOfMonth: parsed.day,
    inCurrentMonth: parsed.month === month && parsed.year === year,
    isToday: dateKey === todayKey,
  };
}

export function buildWeek(dateKey: string, todayKey: string): CalendarCell[] {
  const { month, year } = parseDateKey(dateKey);
  const start = startOfWeek(dateKey);
  return Array.from({ length: 7 }, (_, index) => toCell(addDays(start, index), month, year, todayKey));
}

export function buildMonthGrid(dateKey: string, todayKey: string): CalendarCell[] {
  const { year, month } = parseDateKey(dateKey);
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => toCell(addDays(start, index), month, year, todayKey));
}

export function entriesOnDate<T extends { dateKey: string }>(
  entries: readonly T[],
  dateKey: string,
): T[] {
  return entries.filter((entry) => entry.dateKey === dateKey);
}
