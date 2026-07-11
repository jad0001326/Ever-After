import { NextResponse } from "next/server";
import { mcpResourceUrl, mcpScopes } from "@/lib/mcp-auth";
import { absoluteUrl } from "@/lib/utils";
import { supabaseUrl } from "@/lib/supabase/config";

export function GET() {
  const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" };
  if (!supabaseUrl) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503, headers });
  return NextResponse.json(
    {
      resource: mcpResourceUrl(),
      authorization_servers: [`${supabaseUrl.replace(/\/$/, "")}/auth/v1`],
      scopes_supported: mcpScopes,
      resource_documentation: absoluteUrl("/privacy")
    },
    { headers }
  );
}
