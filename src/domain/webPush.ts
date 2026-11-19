export type WebReminderGate =
  | "unsupported"
  | "unconfigured"
  | "install"
  | "denied"
  | "prompt"
  | "subscribed";

export function webReminderGate(input: {
  pushSupported: boolean;
  configured: boolean;
  ios: boolean;
  installed: boolean;
  permission: "default" | "denied" | "granted";
  subscribed: boolean;
}): WebReminderGate {
  if (!input.pushSupported) {
    return "unsupported";
  }
  if (!input.configured) {
    return "unconfigured";
  }
  if (input.ios && !input.installed) {
    return "install";
  }
  if (input.permission === "denied") {
    return "denied";
  }
  if (input.permission === "granted" && input.subscribed) {
    return "subscribed";
  }
  return "prompt";
}
