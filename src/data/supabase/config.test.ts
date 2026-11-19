import { isServiceRoleKey, readSupabasePublicConfig, readVapidPublicKey, SUPABASE_PUBLIC_ENV, VAPID_PUBLIC_ENV } from "./config";

function jwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  return `eyJhbGciOiJIUzI1NiJ9.${encoded}.signature`;
}

const envName = {
  [SUPABASE_PUBLIC_ENV.url]: "https://example.supabase.co",
  [SUPABASE_PUBLIC_ENV.anonKey]: jwt({ role: "anon" }),
};

describe("configuration Supabase publique", () => {
  it("ne retient que l’URL et la clé anonyme", () => {
    expect(Object.values(SUPABASE_PUBLIC_ENV)).toEqual([
      "EXPO_PUBLIC_SUPABASE_URL",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    ]);
  });

  it("accepte une clé de rôle anon", () => {
    expect(readSupabasePublicConfig(envName)).toEqual({
      ok: true,
      value: {
        url: "https://example.supabase.co",
        anonKey: envName[SUPABASE_PUBLIC_ENV.anonKey],
      },
    });
  });

  it("refuse une configuration absente, une URL non chiffrée, une clé OpenAI ou une clé service", () => {
    expect(readSupabasePublicConfig({})).toEqual({ ok: false, error: "missing_supabase_config" });
    expect(
      readSupabasePublicConfig({
        ...envName,
        [SUPABASE_PUBLIC_ENV.url]: "http://example.supabase.co",
      }),
    ).toEqual({ ok: false, error: "invalid_supabase_url" });

    const openAi = readSupabasePublicConfig({
      ...envName,
      [SUPABASE_PUBLIC_ENV.anonKey]: "sk-proj-abcdefghijklmnopqrstuvwxyz",
    });
    expect(openAi).toEqual({ ok: false, error: "openai_key_in_public_config" });

    const serviceKey = jwt({ role: "service_role" });
    expect(isServiceRoleKey(serviceKey)).toBe(true);
    const rejected = readSupabasePublicConfig({
      ...envName,
      [SUPABASE_PUBLIC_ENV.anonKey]: serviceKey,
    });
    expect(rejected).toEqual({ ok: false, error: "service_role_in_public_config" });
    expect(JSON.stringify(rejected)).not.toContain(serviceKey);
  });

  it("accepte seulement une clé publique VAPID", () => {
    const bytes = new Uint8Array(65);
    bytes[0] = 4;
    bytes[1] = 9;
    const key = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
    expect(readVapidPublicKey({ [VAPID_PUBLIC_ENV]: key })).toBe(key);
    expect(readVapidPublicKey({ [VAPID_PUBLIC_ENV]: "sk-secret" })).toBeNull();
    expect(readVapidPublicKey({})).toBeNull();
  });
});
