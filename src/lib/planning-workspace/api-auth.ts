import { createClient } from "@supabase/supabase-js";
import {
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export type PlanningApiAuthFailure =
  | "missing_bearer"
  | "invalid_bearer"
  | "server_not_configured"
  | "authentication_unavailable"
  | "invalid_token";

export async function authenticatePlanningApiRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return { ok: false, reason: "missing_bearer" } as const;
  }

  const match = /^Bearer[ \t]+(.+)$/i.exec(authorization);
  const token = match?.[1]?.trim() ?? "";
  if (!token || token.length > 8192) {
    return { ok: false, reason: "invalid_bearer" } as const;
  }
  if (!supabaseUrl || !supabasePublishableKey) {
    return { ok: false, reason: "server_not_configured" } as const;
  }

  const supabase = createClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  );

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return { ok: false, reason: "invalid_token" } as const;
    }

    return {
      ok: true,
      supabase,
      user: data.user,
    } as const;
  } catch {
    return { ok: false, reason: "authentication_unavailable" } as const;
  }
}
