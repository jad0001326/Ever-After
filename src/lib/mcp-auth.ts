import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { absoluteUrl } from "@/lib/utils";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export const mcpResourceUrl = () => process.env.OUTREACH_MCP_AUDIENCE ?? absoluteUrl("/api/mcp");
export const mcpResourceMetadataUrl = () => absoluteUrl("/.well-known/oauth-protected-resource");
export const mcpScopes = ["openid", "email", "profile"];

export type McpAuthFailureReason =
  | "missing_bearer"
  | "server_not_configured"
  | "empty_token"
  | "token_expired"
  | "user_lookup_failed"
  | "missing_subject"
  | "profile_lookup_failed"
  | "not_admin";

export type McpAuthenticationResult = {
  authInfo: AuthInfo | null;
  failureReason: McpAuthFailureReason | null;
  hadBearerToken: boolean;
};

export function mcpWwwAuthenticateChallenge() {
  return `Bearer resource_metadata="${mcpResourceMetadataUrl()}", scope="${mcpScopes.join(" ")}", error="invalid_token", error_description="Connect as an EverAft administrator to continue"`;
}

function rejected(reason: McpAuthFailureReason, hadBearerToken = true): McpAuthenticationResult {
  if (hadBearerToken) console.warn("[mcp-auth] bearer token rejected", { reason });
  return { authInfo: null, failureReason: reason, hadBearerToken };
}

export async function authenticateMcpRequest(request: Request): Promise<McpAuthenticationResult> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return rejected("missing_bearer", false);
  if (!supabaseUrl || !supabasePublishableKey) return rejected("server_not_configured");
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return rejected("empty_token");

  const authClient = createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data, error } = await authClient.auth.getClaims(token);
  const claims = data?.claims as Record<string, unknown> | undefined;
  const expectedIssuer = `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;
  const audience = claims?.aud;
  const audiences = Array.isArray(audience) ? audience.map(String) : [String(audience ?? "")];
  const hasMcpClaims =
    !error &&
    claims?.iss === expectedIssuer &&
    audiences.includes(mcpResourceUrl()) &&
    claims?.everaft_mcp === true;
  const claimAdminUserId = hasMcpClaims && typeof claims?.sub === "string" ? claims.sub : null;
  const clientId = typeof claims?.client_id === "string" ? claims.client_id : "everaft-mcp-oauth";
  const expiresAt = typeof claims?.exp === "number" ? claims.exp : undefined;
  if (expiresAt != null && expiresAt <= Math.floor(Date.now() / 1000)) return rejected("token_expired");

  let adminUserId = claimAdminUserId;
  if (!adminUserId) {
    const { data: fallbackUser, error: fallbackError } = await authClient.auth.getUser(token);
    if (fallbackError) return rejected("user_lookup_failed");
    adminUserId = fallbackUser.user?.id ?? null;
  }
  if (!adminUserId) return rejected("missing_subject");

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", adminUserId)
    .single();
  if (profileError) return rejected("profile_lookup_failed");
  if (profile?.role !== "admin") return rejected("not_admin");

  const scopeClaim = claims?.scope;
  const scopes = typeof scopeClaim === "string" ? scopeClaim.split(" ").filter(Boolean) : mcpScopes;
  return {
    authInfo: {
      token,
      clientId,
      scopes,
      expiresAt,
      resource: new URL(mcpResourceUrl()),
      extra: { adminUserId }
    },
    failureReason: null,
    hadBearerToken: true
  };
}

export function mcpUnauthorizedResponse() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "WWW-Authenticate": mcpWwwAuthenticateChallenge()
    }
  });
}
