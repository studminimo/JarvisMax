import type { SupabaseClient } from "@supabase/supabase-js";

import { type PlannedReminder } from "@/domain/reminders";
import { err, ok, type Result } from "@/domain/result";

const FAILURE = "Les rappels n’ont pas pu être préparés.";

export type PushSubscriptionDraft = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function savePushSubscription(
  client: SupabaseClient,
  userId: string,
  draft: PushSubscriptionDraft,
): Promise<Result<string>> {
  const { data, error } = await client
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint: draft.endpoint, p256dh: draft.p256dh, auth: draft.auth },
      { onConflict: "user_id,endpoint" },
    )
    .select("endpoint")
    .maybeSingle();
  if (error || data?.endpoint !== draft.endpoint) {
    return err(FAILURE);
  }
  return ok(draft.endpoint);
}

export async function subscriptionIsStored(client: SupabaseClient, userId: string, endpoint: string): Promise<boolean> {
  const { data, error } = await client
    .from("push_subscriptions")
    .select("endpoint")
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .maybeSingle();
  return !error && data?.endpoint === endpoint;
}

export async function savePushPlan(client: SupabaseClient, userId: string, plan: readonly PlannedReminder[]): Promise<Result<number>> {
  const removed = await client.from("scheduled_pushes").delete().eq("user_id", userId).is("sent_at", null).select("notification_key");
  if (removed.error) {
    return err(FAILURE);
  }
  if (plan.length === 0) {
    return ok(0);
  }
  const rows = plan.map((item) => ({
    user_id: userId,
    notification_key: item.key,
    fire_at: item.fireAt,
    title: item.title,
    sent_at: null,
  }));
  const inserted = await client.from("scheduled_pushes").upsert(rows, { onConflict: "user_id,notification_key", ignoreDuplicates: true }).select("notification_key");
  if (inserted.error) {
    return err(FAILURE);
  }
  const keys = plan.map((item) => item.key);
  const stored = await client.from("scheduled_pushes").select("notification_key, sent_at").eq("user_id", userId).in("notification_key", keys);
  if (stored.error || !Array.isArray(stored.data) || stored.data.length !== plan.length) {
    return err(FAILURE);
  }
  const pending = stored.data.filter((row) => row.sent_at == null).length;
  return ok(pending);
}
