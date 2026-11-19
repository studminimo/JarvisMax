import "expo-sqlite/localStorage/install";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLIC_ENV } from "./config";
import { openSupabase } from "./open";

let client: SupabaseClient | null = null;

export function getSupabase() {
  return openSupabase(publicEnv(), (config) => {
    client ??= createClient(config.url, config.anonKey, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    return client;
  });
}

function publicEnv(): Record<string, string | undefined> {
  return {
    [SUPABASE_PUBLIC_ENV.url]: process.env.EXPO_PUBLIC_SUPABASE_URL,
    [SUPABASE_PUBLIC_ENV.anonKey]: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}
