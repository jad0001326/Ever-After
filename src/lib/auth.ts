import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function requireAdmin() {
  if (!isSupabaseConfigured) {
    redirect("/login?message=Configure+Supabase+environment+variables+first");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase!.auth.getUser();

  if (!user) redirect("/login?message=Sign+in+to+access+admin");

  const { data: profile } = await supabase!.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/venues?message=Admin+access+required");

  return { user };
}

export async function requireUser(redirectTo: string, message = "Sign in to continue") {
  if (!isSupabaseConfigured) {
    redirect(`/login?message=Configure+Supabase+environment+variables+first&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase!.auth.getUser();

  if (!user) redirect(`/login?message=${encodeURIComponent(message)}&redirectTo=${encodeURIComponent(redirectTo)}`);

  return { user, supabase };
}
