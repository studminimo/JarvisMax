import { Platform } from "react-native";

import { getSupabase } from "@/data/supabase/client";
import { readVapidPublicKey, VAPID_PUBLIC_ENV } from "@/data/supabase/config";
import { savePushSubscription, subscriptionIsStored } from "@/data/supabase/push";
import { webReminderGate } from "@/domain/webPush";

import { type ReminderSync } from "./device";

type EnableResult = { ok: true } | { ok: false; reminders: ReminderSync };

function vapidBytes(key: string): ArrayBuffer | null {
  const padded = key.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((key.length + 3) % 4);
  try {
    const binary = globalThis.atob(padded);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.byteLength === 65 ? bytes.buffer : null;
  } catch {
    return null;
  }
}

function configuredKey(): string | null {
  return readVapidPublicKey({ [VAPID_PUBLIC_ENV]: process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY });
}

function iosDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function siteInstalled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const modes = window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches;
  return modes || (navigator as { standalone?: boolean }).standalone === true;
}

function permissionState(): "default" | "denied" | "granted" {
  if (typeof Notification === "undefined") {
    return "default";
  }
  if (Notification.permission === "denied" || Notification.permission === "granted") {
    return Notification.permission;
  }
  return "default";
}

function pushSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

function gate(subscribed: boolean): ReminderSync {
  const result = webReminderGate({
    pushSupported: pushSupported(),
    configured: configuredKey() !== null,
    ios: iosDevice(),
    installed: siteInstalled(),
    permission: permissionState(),
    subscribed,
  });
  if (result === "install") {
    return { kind: "web-install" };
  }
  if (result === "unconfigured") {
    return { kind: "web-unconfigured" };
  }
  if (result === "unsupported") {
    return { kind: "web-unsupported" };
  }
  if (result === "denied") {
    return { kind: "web-denied" };
  }
  if (result === "subscribed") {
    return { kind: "web-subscribed" };
  }
  return { kind: "web-prompt" };
}

export async function inspectWebReminders(userId: string): Promise<ReminderSync> {
  if (Platform.OS !== "web") {
    return { kind: "unsupported" };
  }
  const early = gate(false);
  if (early.kind !== "web-prompt") {
    return early;
  }
  const registered = await registration();
  const existing = registered ? await registered.pushManager.getSubscription() : null;
  if (!existing || permissionState() !== "granted") {
    return { kind: "web-prompt" };
  }
  const opened = getSupabase();
  if (!opened.ok) {
    return { kind: "web-failed" };
  }
  const stored = await subscriptionIsStored(opened.value, userId, existing.endpoint);
  return stored ? { kind: "web-subscribed" } : { kind: "web-prompt" };
}

export async function enableWebReminders(userId: string): Promise<EnableResult> {
  if (Platform.OS !== "web") {
    return { ok: false, reminders: { kind: "unsupported" } };
  }
  const blocked = gate(false);
  if (blocked.kind === "web-install" || blocked.kind === "web-unconfigured" || blocked.kind === "web-unsupported") {
    return { ok: false, reminders: blocked };
  }
  const key = configuredKey();
  const bytes = key ? vapidBytes(key) : null;
  if (!bytes) {
    return { ok: false, reminders: { kind: "web-unconfigured" } };
  }
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return { ok: false, reminders: { kind: "web-failed" } };
  }
  if (permission !== "granted") {
    return { ok: false, reminders: { kind: "web-denied" } };
  }
  const registered = await registration();
  if (!registered) {
    return { ok: false, reminders: { kind: "web-failed" } };
  }
  try {
    const existing = await registered.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registered.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      }));
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
      return { ok: false, reminders: { kind: "web-failed" } };
    }
    const opened = getSupabase();
    if (!opened.ok) {
      return { ok: false, reminders: { kind: "web-failed" } };
    }
    const saved = await savePushSubscription(opened.value, userId, {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    return saved.ok ? { ok: true } : { ok: false, reminders: { kind: "web-failed" } };
  } catch {
    return { ok: false, reminders: { kind: "web-failed" } };
  }
}
