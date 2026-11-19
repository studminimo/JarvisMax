import { NAME_LIMIT } from "./board";
import { isNotificationProfile, type NotificationProfile } from "./reminders";
import { err, ok, type Result } from "./result";
import { parseClock } from "./time";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
export const EMAIL_MAX = 254;

export const PROFILE_TIME_ZONES = [
  "Europe/Paris",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/London",
  "America/Montreal",
  "America/Cayenne",
  "Indian/Reunion",
  "Pacific/Tahiti",
] as const;

export type AccountProfile = {
  userId: string;
  givenName: string;
  timeZone: string;
  notificationProfile: NotificationProfile;
  dayStart: string;
  dayEnd: string;
};

export type AccountFailure =
  | "invalid_email"
  | "password_too_short"
  | "password_too_long"
  | "password_rejected"
  | "name_too_long"
  | "invalid_time_zone"
  | "invalid_profile"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "email_taken"
  | "rate_limited"
  | "rejected"
  | "unavailable";

export function parseEmail(value: string): Result<string, AccountFailure> {
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    return err("invalid_email");
  }
  return ok(email);
}

export function parsePassword(value: string): Result<string, AccountFailure> {
  if (value.length < PASSWORD_MIN) {
    return err("password_too_short");
  }
  if (value.length > PASSWORD_MAX) {
    return err("password_too_long");
  }
  return ok(value);
}

/** Un prénom vide est accepté : il sert à effacer le nom déjà enregistré. */
export function parseGivenName(value: string): Result<string, AccountFailure> {
  const givenName = value.trim().replace(/\s+/g, " ");
  if (givenName.length > NAME_LIMIT) {
    return err("name_too_long");
  }
  return ok(givenName);
}

export function isValidTimeZone(value: string): boolean {
  const zone = value.trim();
  if (zone.length === 0) {
    return false;
  }
  try {
    Intl.DateTimeFormat("fr-FR", { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function parseTimeZone(value: string): Result<string, AccountFailure> {
  const timeZone = value.trim();
  if (!isValidTimeZone(timeZone)) {
    return err("invalid_time_zone");
  }
  return ok(timeZone);
}

export function profileFromRow(row: unknown): Result<AccountProfile, AccountFailure> {
  if (!row || typeof row !== "object") {
    return err("invalid_profile");
  }
  const record = row as Record<string, unknown>;
  const userId = record.user_id;
  const givenName = record.given_name;
  const timeZone = record.time_zone;
  if (typeof userId !== "string" || userId.length === 0) {
    return err("invalid_profile");
  }
  if (typeof givenName !== "string" || typeof timeZone !== "string") {
    return err("invalid_profile");
  }
  const name = parseGivenName(givenName);
  if (!name.ok) {
    return name;
  }
  const zone = parseTimeZone(timeZone);
  if (!zone.ok) {
    return err("invalid_profile");
  }
  const notificationProfile = readProfileName(record.notification_profile);
  const dayStart = readClock(record.day_start, "07:00");
  const dayEnd = readClock(record.day_end, "22:00");
  if (!notificationProfile || !dayStart || !dayEnd) {
    return err("invalid_profile");
  }
  return ok({
    userId,
    givenName: name.value,
    timeZone: zone.value,
    notificationProfile,
    dayStart,
    dayEnd,
  });
}

function readProfileName(value: unknown): NotificationProfile | null {
  if (value === undefined) {
    return "normal";
  }
  return typeof value === "string" && isNotificationProfile(value) ? value : null;
}

function readClock(value: unknown, fallback: string): string | null {
  if (value === undefined) {
    return fallback;
  }
  return typeof value === "string" ? parseClock(value) : null;
}

export function accountErrorMessage(code: AccountFailure): string {
  switch (code) {
    case "invalid_email":
      return "L’adresse e-mail n’est pas valide.";
    case "password_too_short":
      return `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`;
    case "password_too_long":
      return `${PASSWORD_MAX} caractères maximum.`;
    case "password_rejected":
      return "Le mot de passe ne respecte pas les règles du compte.";
    case "name_too_long":
      return `${NAME_LIMIT} caractères maximum.`;
    case "invalid_time_zone":
      return "Ce fuseau n’est pas reconnu.";
    case "invalid_profile":
      return "Le profil reçu est illisible.";
    case "invalid_credentials":
      return "Adresse ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Confirme l’adresse reçue par message, puis connecte-toi.";
    case "email_taken":
      return "Un compte existe déjà pour cette adresse. Connecte-toi.";
    case "rate_limited":
      return "Trop d’essais. Réessaie dans un moment.";
    case "rejected":
      return "La demande a été refusée.";
    case "unavailable":
      return "Le serveur n’a pas répondu.";
  }
}

export function authCodeToFailure(code: string | undefined): AccountFailure {
  switch (code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "user_already_exists":
    case "email_exists":
      return "email_taken";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rate_limited";
    case "weak_password":
      return "password_rejected";
    default:
      return "rejected";
  }
}

export function timeZoneChoices(current: string): readonly string[] {
  const zone = current.trim();
  const known: readonly string[] = PROFILE_TIME_ZONES;
  if (zone.length > 0 && !known.includes(zone) && isValidTimeZone(zone)) {
    return [zone, ...PROFILE_TIME_ZONES];
  }
  return PROFILE_TIME_ZONES;
}
