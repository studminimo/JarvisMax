export const PRODUCT_TIME_ZONE = "Europe/Paris";

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new Error("Date invalide");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error("Date invalide");
  }
  return { year, month, day };
}

export function addDays(dateKey: string, amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new Error("Décalage invalide");
  }
  const { year, month, day } = parseDateKey(dateKey);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return formatDateKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export function addMonths(dateKey: string, amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new Error("Décalage invalide");
  }
  const { year, month, day } = parseDateKey(dateKey);
  const firstOfTarget = new Date(Date.UTC(year, month - 1 + amount, 1));
  const lastDay = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return formatDateKey(
    firstOfTarget.getUTCFullYear(),
    firstOfTarget.getUTCMonth() + 1,
    Math.min(day, lastDay),
  );
}

export function weekdayIndexMonday(dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  const sundayBased = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sundayBased + 6) % 7;
}

export function startOfWeek(dateKey: string): string {
  return addDays(dateKey, -weekdayIndexMonday(dateKey));
}

export function zonedParts(instant: Date, timeZone = PRODUCT_TIME_ZONE): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map = new Map(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  const hour = Number(map.get("hour"));
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour: hour === 24 ? 0 : hour,
    minute: Number(map.get("minute")),
  };
}

export function zonedDateKey(instant: Date, timeZone = PRODUCT_TIME_ZONE): string {
  const parts = zonedParts(instant, timeZone);
  return formatDateKey(parts.year, parts.month, parts.day);
}

export type Greeting = "Bonjour" | "Bon après-midi" | "Bonsoir";

export function greetingForHour(hour: number): Greeting {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("Heure invalide");
  }
  if (hour < 5 || hour >= 18) {
    return "Bonsoir";
  }
  if (hour < 12) {
    return "Bonjour";
  }
  return "Bon après-midi";
}

export function parseClock(value: string): string | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return `${match[1]}:${match[2]}`;
}

/** Instant UTC correspondant à une heure civile dans un fuseau. */
export function zonedInstant(dateKey: string, clock: string, timeZone = PRODUCT_TIME_ZONE): Date {
  const time = parseClock(clock);
  if (!time) {
    throw new Error("Heure invalide");
  }
  const { year, month, day } = parseDateKey(dateKey);
  const [hour, minute] = time.split(":").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let pass = 0; pass < 2; pass += 1) {
    const seen = zonedParts(new Date(utc), timeZone);
    const wanted = Date.UTC(year, month - 1, day, hour, minute);
    const got = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    utc += wanted - got;
  }
  return new Date(utc);
}

export function instantStamp(instant: Date): string {
  return instant.toISOString().replace(/\.\d{3}Z$/u, "Z");
}

export function formatClock(instant: Date, timeZone = PRODUCT_TIME_ZONE): string {
  const parts = zonedParts(instant, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function noon(dateKey: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("fr-FR") + value.slice(1);
}

export function formatLongDate(dateKey: string, timeZone = PRODUCT_TIME_ZONE): string {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(noon(dateKey));
  return capitalize(formatted);
}

export function formatMonthTitle(dateKey: string, timeZone = PRODUCT_TIME_ZONE): string {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone,
  }).format(noon(dateKey));
  return capitalize(formatted);
}

function formatDayMonth(dateKey: string, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone,
  }).format(noon(dateKey));
}

export function formatWeekTitle(dateKey: string, timeZone = PRODUCT_TIME_ZONE): string {
  const start = startOfWeek(dateKey);
  const end = addDays(start, 6);
  const startParts = parseDateKey(start);
  const endParts = parseDateKey(end);
  const startLabel = formatDayMonth(start, timeZone);
  const endLabel = formatDayMonth(end, timeZone);
  if (startParts.year === endParts.year) {
    return `${startLabel} – ${endLabel} ${endParts.year}`;
  }
  return `${startLabel} ${startParts.year} – ${endLabel} ${endParts.year}`;
}
