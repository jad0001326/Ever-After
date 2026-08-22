import "react-native-url-polyfill/auto";

import { createClient, processLock } from "@supabase/supabase-js";
import type { SupabaseSessionStorage } from "./session-storage";

export type EverAftSupabaseConfig = Readonly<{
  url: string;
  publishableKey: string;
}>;

export function createEverAftSupabaseClient(
  config: EverAftSupabaseConfig,
  storage: SupabaseSessionStorage,
) {
  validatePublicClientConfig(config);
  return createClient(config.url, config.publishableKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });
}

function validatePublicClientConfig(config: EverAftSupabaseConfig) {
  const url = new URL(config.url);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("Supabase URL must use HTTPS outside localhost.");
  }
  if (!config.publishableKey.trim()) {
    throw new Error("A Supabase publishable key is required.");
  }
  if (/^(sb_secret_|service_role)/i.test(config.publishableKey.trim())) {
    throw new Error("Secret Supabase keys must never be used in the mobile client.");
  }
}
