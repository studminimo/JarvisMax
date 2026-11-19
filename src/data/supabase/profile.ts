import type { SupabaseClient } from "@supabase/supabase-js";

import { parseGivenName, parseTimeZone, profileFromRow, type AccountFailure, type AccountProfile } from "@/domain/account";
import { isNotificationProfile } from "@/domain/reminders";
import { err, type Result } from "@/domain/result";

const COLUMNS = "user_id, given_name, time_zone, notification_profile, day_start, day_end";

export type ProfileRow = {
  user_id: string;
  given_name: string;
  time_zone: string;
  notification_profile: string;
  day_start: string;
  day_end: string;
};

export type ProfileStore = {
  read(userId: string): Promise<{ row: ProfileRow | null; failed: boolean }>;
  insert(userId: string): Promise<{ row: ProfileRow | null; failed: boolean }>;
  update(
    userId: string,
    patch: { given_name?: string; time_zone?: string; notification_profile?: string },
  ): Promise<{ row: ProfileRow | null; failed: boolean }>;
};

export async function loadAccountProfile(
  store: ProfileStore,
  userId: string,
): Promise<Result<AccountProfile, AccountFailure>> {
  const read = await store.read(userId);
  if (read.failed) {
    return err("unavailable");
  }
  if (read.row) {
    return profileFromRow(read.row);
  }
  const inserted = await store.insert(userId);
  if (inserted.failed || !inserted.row) {
    return err("unavailable");
  }
  return profileFromRow(inserted.row);
}

export async function saveAccountProfile(
  store: ProfileStore,
  userId: string,
  patch: { givenName?: string; timeZone?: string; notificationProfile?: string },
): Promise<Result<AccountProfile, AccountFailure>> {
  const body: { given_name?: string; time_zone?: string; notification_profile?: string } = {};
  if (patch.givenName !== undefined) {
    const name = parseGivenName(patch.givenName);
    if (!name.ok) {
      return name;
    }
    body.given_name = name.value;
  }
  if (patch.timeZone !== undefined) {
    const zone = parseTimeZone(patch.timeZone);
    if (!zone.ok) {
      return zone;
    }
    body.time_zone = zone.value;
  }
  if (patch.notificationProfile !== undefined) {
    if (!isNotificationProfile(patch.notificationProfile)) {
      return err("invalid_profile");
    }
    body.notification_profile = patch.notificationProfile;
  }
  if (
    body.given_name === undefined &&
    body.time_zone === undefined &&
    body.notification_profile === undefined
  ) {
    return err("unavailable");
  }
  const updated = await store.update(userId, body);
  if (updated.failed || !updated.row) {
    return err("unavailable");
  }
  const profile = profileFromRow(updated.row);
  if (!profile.ok) {
    return profile;
  }
  if (body.given_name !== undefined && profile.value.givenName !== body.given_name) {
    return err("unavailable");
  }
  if (body.time_zone !== undefined && profile.value.timeZone !== body.time_zone) {
    return err("unavailable");
  }
  if (
    body.notification_profile !== undefined &&
    profile.value.notificationProfile !== body.notification_profile
  ) {
    return err("unavailable");
  }
  return profile;
}

function asRow(value: unknown): ProfileRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.user_id !== "string" ||
    typeof record.given_name !== "string" ||
    typeof record.time_zone !== "string" ||
    typeof record.notification_profile !== "string" ||
    typeof record.day_start !== "string" ||
    typeof record.day_end !== "string"
  ) {
    return null;
  }
  return {
    user_id: record.user_id,
    given_name: record.given_name,
    time_zone: record.time_zone,
    notification_profile: record.notification_profile,
    day_start: record.day_start,
    day_end: record.day_end,
  };
}

export function supabaseProfileStore(supabase: SupabaseClient): ProfileStore {
  return {
    async read(userId) {
      const { data, error } = await supabase.from("profiles").select(COLUMNS).eq("user_id", userId).maybeSingle();
      if (error) {
        return { row: null, failed: true };
      }
      return { row: asRow(data), failed: false };
    },
    async insert(userId) {
      const { data, error } = await supabase
        .from("profiles")
        .insert({ user_id: userId })
        .select(COLUMNS)
        .maybeSingle();
      if (error) {
        return { row: null, failed: true };
      }
      return { row: asRow(data), failed: false };
    },
    async update(userId, patch) {
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", userId)
        .select(COLUMNS)
        .maybeSingle();
      if (error) {
        return { row: null, failed: true };
      }
      return { row: asRow(data), failed: false };
    },
  };
}
