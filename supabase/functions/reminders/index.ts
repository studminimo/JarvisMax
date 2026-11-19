import { isDuePush, PUSH_GRACE_MS } from "./due.ts";

const LIMIT = 40;

type PushRow = {
  user_id: string;
  notification_key: string;
  title: string;
  fire_at: string;
};

type SubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return json(405, { error: "unavailable" });
  }
  try {
    return await handle(request);
  } catch {
    return json(502, { error: "unavailable" });
  }
});

async function handle(request: Request): Promise<Response> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("REMINDERS_CRON_SECRET") ?? "";
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!url.startsWith("https://") || !serviceKey || !cronSecret || !publicKey || !privateKey || !sameSecret(provided, cronSecret)) {
    return json(503, { error: "unavailable" });
  }

  const now = Date.now();
  const cutoff = new Date(now - PUSH_GRACE_MS).toISOString();
  await rest(url, serviceKey, `scheduled_pushes?sent_at=is.null&fire_at=lt.${encodeURIComponent(cutoff)}`, { method: "DELETE" });
  const due = await rest(
    url,
    serviceKey,
    `scheduled_pushes?select=user_id,notification_key,title,fire_at&sent_at=is.null&fire_at=lte.${encodeURIComponent(new Date(now).toISOString())}&fire_at=gte.${encodeURIComponent(cutoff)}&limit=${LIMIT}`,
  );
  if (!due.ok || !Array.isArray(due.body)) {
    return json(502, { error: "unavailable" });
  }
  const rows = due.body.filter(isPushRow).filter((row) => isDuePush(row.fire_at, now));
  if (rows.length === 0) {
    return json(200, { sent: 0 });
  }
  const ids = [...new Set(rows.map((row) => row.user_id))].filter((id) => USER_ID.test(id));
  const subscriptions = await rest(
    url,
    serviceKey,
    `push_subscriptions?select=user_id,endpoint,p256dh,auth&user_id=in.(${ids.join(",")})`,
  );
  if (!subscriptions.ok || !Array.isArray(subscriptions.body)) {
    return json(502, { error: "unavailable" });
  }
  const byUser = new Map<string, SubscriptionRow[]>();
  for (const item of subscriptions.body) {
    if (!isSubscription(item)) {
      continue;
    }
    const list = byUser.get(item.user_id) ?? [];
    list.push(item);
    byUser.set(item.user_id, list);
  }

  const webpush = (await import("npm:web-push@3.6.7")).default as {
    setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
    sendNotification: (
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string,
      options: { TTL: number; urgency: "high" },
    ) => Promise<{ statusCode: number }>;
  };
  webpush.setVapidDetails("mailto:reminders@jarvis.app", publicKey, privateKey);

  let sent = 0;
  for (const row of rows) {
    const targets = byUser.get(row.user_id) ?? [];
    let delivered = false;
    for (const target of targets) {
      const outcome = await sendOne(webpush, target, row.title);
      if (outcome === "gone") {
        await rest(url, serviceKey, `push_subscriptions?user_id=eq.${target.user_id}&endpoint=eq.${encodeURIComponent(target.endpoint)}`, {
          method: "DELETE",
        });
      }
      delivered = delivered || outcome === "sent";
    }
    if (!delivered) {
      continue;
    }
    const marked = await rest(
      url,
      serviceKey,
      `scheduled_pushes?user_id=eq.${row.user_id}&notification_key=eq.${encodeURIComponent(row.notification_key)}`,
      { method: "PATCH", body: JSON.stringify({ sent_at: new Date().toISOString() }) },
    );
    if (marked.ok) {
      sent += 1;
    }
  }
  return json(200, { sent });
}

async function sendOne(
  webpush: {
    sendNotification: (
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string,
      options: { TTL: number; urgency: "high" },
    ) => Promise<{ statusCode: number }>;
  },
  target: SubscriptionRow,
  title: string,
): Promise<"sent" | "gone" | "failed"> {
  try {
    const result = await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify({ title: "Jarvis", body: title }),
      { TTL: 60, urgency: "high" },
    );
    return result.statusCode >= 200 && result.statusCode < 300 ? "sent" : "failed";
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}

async function rest(url: string, key: string, path: string, init: RequestInit = {}): Promise<{ ok: boolean; body: unknown }> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: "application/json",
      "content-type": "application/json",
      prefer: "return=representation",
    },
  });
  const text = await response.text();
  if (!text) {
    return { ok: response.ok, body: null };
  }
  try {
    return { ok: response.ok, body: JSON.parse(text) };
  } catch {
    return { ok: false, body: null };
  }
}

function isPushRow(value: unknown): value is PushRow {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.user_id === "string" && typeof row.notification_key === "string" && typeof row.title === "string" && typeof row.fire_at === "string";
}

function isSubscription(value: unknown): value is SubscriptionRow {
  if (!value || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.user_id === "string" && typeof row.endpoint === "string" && typeof row.p256dh === "string" && typeof row.auth === "string";
}

function sameSecret(left: string, right: string): boolean {
  if (left.length === 0 || left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "content-type": "application/json" } });
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  };
}
