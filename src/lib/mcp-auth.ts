import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { absoluteUrl } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export const mcpResourceUrl = () => process.env.OUTREACH_MCP_AUDIENCE ?? absoluteUrl("/api/mcp");
export const mcpResourceMetadataUrl = () => absoluteUrl("/.well-known/oauth-protected-resource");
export const mcpScopes = ["openid", "email", "profile"];

export function mcpWwwAuthenticateChallenge() {
  return `Bearer resource_metadata="${mcpResourceMetadataUrl()}", scope="${mcpScopes.join(" ")}", error="invalid_token", error_description="Connect as an EverAft administrator to continue"`;
}

export async function authenticateMcpRequest(request: Request): Promise<AuthInfo | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !supabasePublishableKey) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  const authClient = createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data, error } = await authClient.auth.getClaims(token);
  if (error || !data?.claims) return null;
  const claims = data.claims as Record<string, unknown>;
  const expectedIssuer = `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;
  const audience = claims.aud;
  const audiences = Array.isArray(audience) ? audience.map(String) : [String(audience ?? "")];
  const adminUserId = typeof claims.sub === "string" ? claims.sub : null;
  const clientId = typeof claims.client_id === "string" ? claims.client_id : null;
  const expiresAt = typeof claims.exp === "number" ? claims.exp : undefined;
  if (
    claims.iss !== expectedIssuer ||
    !audiences.includes(mcpResourceUrl()) ||
    claims.everaft_mcp !== true ||
    !adminUserId ||
    !clientId ||
    (expiresAt != null && expiresAt <= Math.floor(Date.now() / 1000))
  ) {
    return null;
  }

  const adminClient = createAdminClient();
  if (!adminClient) return null;
  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", adminUserId).single();
  if (profile?.role !== "admin") return null;

  const scopeClaim = claims.scope;
  const scopes = typeof scopeClaim === "string" ? scopeClaim.split(" ").filter(Boolean) : mcpScopes;
  return {
    token,
    clientId,
    scopes,
    expiresAt,
    resource: new URL(mcpResourceUrl()),
    extra: { adminUserId }
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
