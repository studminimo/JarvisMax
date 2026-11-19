export const PUSH_GRACE_MS = 15 * 60 * 1000;

export function isDuePush(fireAt: string, nowMs: number, graceMs = PUSH_GRACE_MS): boolean {
  const at = Date.parse(fireAt);
  return !Number.isNaN(at) && at <= nowMs && nowMs - at <= graceMs;
}
