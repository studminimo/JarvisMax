import { Platform } from "react-native";

import { type PlannedReminder } from "@/domain/reminders";

export type ReminderSync =
  | { kind: "unsupported" }
  | { kind: "denied" }
  | { kind: "failed" }
  | { kind: "scheduled"; count: number }
  | { kind: "web-install" }
  | { kind: "web-unconfigured" }
  | { kind: "web-unsupported" }
  | { kind: "web-denied" }
  | { kind: "web-prompt" }
  | { kind: "web-failed" }
  | { kind: "web-subscribed" }
  | { kind: "web-ready"; count: number };

export async function requestReminderAccess(): Promise<"unsupported" | "denied" | "granted"> {
  if (Platform.OS === "web") {
    return "unsupported";
  }
  try {
    const Notifications = await import("expo-notifications");
    const result = await Notifications.requestPermissionsAsync();
    return result.status === "granted" ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

export async function syncReminders(plan: readonly PlannedReminder[]): Promise<ReminderSync> {
  if (Platform.OS === "web") {
    return { kind: "unsupported" };
  }
  try {
    const Notifications = await import("expo-notifications");
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") {
      return { kind: "denied" };
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("jarvis", {
        name: "Rappels",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((item) => item.identifier.startsWith("jarvis:"))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );
    let count = 0;
    for (const item of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: item.key,
        content: { title: "Jarvis", body: item.title },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.fireAt) },
      });
      count += 1;
    }
    return { kind: "scheduled", count };
  } catch {
    return { kind: "failed" };
  }
}
