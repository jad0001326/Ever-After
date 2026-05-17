"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

function authFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Authentication failed.";
  if (message.includes("Unexpected token '<'")) {
    return "Supabase Auth returned an HTML response. Check that NEXT_PUBLIC_SUPABASE_URL is your Supabase project URL and that the Auth URL settings are configured.";
  }
  return message;
}

function safeRedirectPath(value: FormDataEntryValue | null) {
  const path = value?.toString() || "/venues";
  if (!path.startsWith("/") || path.startsWith("//")) return "/venues";
  return path;
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect("/login?message=Configure+Supabase+environment+variables+first");

  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const { error } = await supabase.auth.signInWithPassword({ email, password }).catch((error: unknown) => ({
    error: new Error(authFailureMessage(error))
  }));

  if (error) redirect(`/login?message=${encodeURIComponent(error.message)}`);
  redirect(safeRedirectPath(formData.get("redirectTo")));
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect("/signup?message=Configure+Supabase+environment+variables+first");

  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const fullName = formData.get("fullName")?.toString() ?? "";
  const redirectTo = safeRedirectPath(formData.get("redirectTo"));
  const { error } = await supabase.auth
    .signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: absoluteUrl(`/login?message=Email+confirmed.+You+can+now+sign+in&redirectTo=${encodeURIComponent(redirectTo)}`)
      }
    })
    .catch((error: unknown) => ({
      error: new Error(authFailureMessage(error))
    }));

  if (error) redirect(`/signup?message=${encodeURIComponent(error.message)}`);
  redirect(`/login?message=Check+your+email+to+confirm+your+account&redirectTo=${encodeURIComponent(redirectTo)}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect("/");
}
