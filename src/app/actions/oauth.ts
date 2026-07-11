"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function decideOAuthAuthorization(formData: FormData) {
  const authorizationId = formData.get("authorizationId")?.toString();
  const decision = formData.get("decision")?.toString();
  if (!authorizationId || (decision !== "approve" && decision !== "deny")) {
    redirect("/oauth/consent?message=Invalid+authorization+request");
  }

  const supabase = await createClient();
  if (!supabase) redirect("/login?message=Configure+Supabase+environment+variables+first");
  const result = decision === "approve"
    ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });

  if (result.error || !result.data?.redirect_url) {
    redirect(`/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}&message=${encodeURIComponent(result.error?.message ?? "Authorization failed")}`);
  }
  redirect(result.data.redirect_url);
}
