import { err, ok, type Result } from "@/domain/result";

export const SUPABASE_PUBLIC_ENV = {
  url: "EXPO_PUBLIC_SUPABASE_URL",
  anonKey: "EXPO_PUBLIC_SUPABASE_ANON_KEY",
} as const;

export const VAPID_PUBLIC_ENV = "EXPO_PUBLIC_VAPID_PUBLIC_KEY";

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseConfigError =
  | "missing_supabase_config"
  | "invalid_supabase_url"
  | "openai_key_in_public_config"
  | "service_role_in_public_config";

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return globalThis.atob(padded);
}

export function isServiceRoleKey(key: string): boolean {
  const parts = key.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return false;
  }
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

/** Lit uniquement l’URL et la clé anonyme. Le client n’est créé qu’ensuite, si cette lecture réussit. */
export function readSupabasePublicConfig(
  env: Record<string, string | undefined>,
): Result<SupabasePublicConfig, SupabaseConfigError> {
  const url = env[SUPABASE_PUBLIC_ENV.url]?.trim() ?? "";
  const anonKey = env[SUPABASE_PUBLIC_ENV.anonKey]?.trim() ?? "";
  if (!url || !anonKey) {
    return err("missing_supabase_config");
  }
  if (anonKey.startsWith("sk-")) {
    return err("openai_key_in_public_config");
  }
  if (isServiceRoleKey(anonKey)) {
    return err("service_role_in_public_config");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return err("invalid_supabase_url");
    }
  } catch {
    return err("invalid_supabase_url");
  }
  return ok({ url, anonKey });
}

/** Clé publique VAPID. La clé privée reste un secret de la fonction reminders. */
export function readVapidPublicKey(env: Record<string, string | undefined>): string | null {
  const key = env[VAPID_PUBLIC_ENV]?.trim() ?? "";
  if (!key || key.startsWith("sk-") || key.includes("PRIVATE") || isServiceRoleKey(key)) {
    return null;
  }
  const padded = key.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((key.length + 3) % 4);
  try {
    const binary = globalThis.atob(padded);
    return binary.length === 65 && binary.charCodeAt(0) === 4 ? key : null;
  } catch {
    return null;
  }
}
