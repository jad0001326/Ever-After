import type { EverAftSupabaseConfig } from "./supabase-client";

export type NativeAuthConfiguration =
  | Readonly<{ status: "configured"; config: EverAftSupabaseConfig }>
  | Readonly<{ status: "not_configured" | "invalid_configuration"; config: null }>;

export function resolveNativeAuthConfiguration(input: Readonly<{
  supabaseUrl?: string;
  publishableKey?: string;
}>): NativeAuthConfiguration {
  const url = input.supabaseUrl?.trim() ?? "";
  const publishableKey = input.publishableKey?.trim() ?? "";
  if (!url && !publishableKey) {
    return Object.freeze({ status: "not_configured", config: null });
  }
  if (!url || !publishableKey) {
    return Object.freeze({ status: "invalid_configuration", config: null });
  }
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
      return Object.freeze({ status: "invalid_configuration", config: null });
    }
    if (!publishableKey.startsWith("sb_publishable_")) {
      return Object.freeze({ status: "invalid_configuration", config: null });
    }
  } catch {
    return Object.freeze({ status: "invalid_configuration", config: null });
  }
  return Object.freeze({
    status: "configured",
    config: Object.freeze({ url, publishableKey }),
  });
}

export function readBundledNativeAuthConfiguration() {
  return resolveNativeAuthConfiguration({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
