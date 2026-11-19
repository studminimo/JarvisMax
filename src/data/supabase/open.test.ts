import { SUPABASE_PUBLIC_ENV } from "./config";
import { openSupabase } from "./open";

describe("ouverture du client Supabase", () => {
  it("ne crée pas de client quand la configuration publique est absente", () => {
    const create = jest.fn();
    expect(openSupabase({}, create)).toEqual({ ok: false, error: "missing_supabase_config" });
    expect(create).not.toHaveBeenCalled();
  });

  it("crée le client avec l’URL et la clé déjà validées", () => {
    const create = jest.fn((config: { url: string; anonKey: string }) => ({ received: config.url }));
    const env = {
      [SUPABASE_PUBLIC_ENV.url]: "https://example.supabase.co",
      [SUPABASE_PUBLIC_ENV.anonKey]: "anon-public-key",
    };
    expect(openSupabase(env, create)).toEqual({
      ok: true,
      value: { received: "https://example.supabase.co" },
    });
    expect(create).toHaveBeenCalledWith({
      url: "https://example.supabase.co",
      anonKey: "anon-public-key",
    });
  });
});
