import { ok, type Result } from "@/domain/result";

import { readSupabasePublicConfig, type SupabaseConfigError, type SupabasePublicConfig } from "./config";

/** N’appelle `create` que si l’URL et la clé anonyme sont acceptées. */
export function openSupabase<T>(
  env: Record<string, string | undefined>,
  create: (config: SupabasePublicConfig) => T,
): Result<T, SupabaseConfigError> {
  const config = readSupabasePublicConfig(env);
  if (!config.ok) {
    return config;
  }
  return ok(create(config.value));
}
