import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function requireAdmin() {
  if (!isSupabaseConfigured) {
    return { demoMode: true, user: null };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase!.auth.getUser();

  if (!user) redirect("/login?message=Sign+in+to+access+admin");

  const { data: profile } = await supabase!.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/venues?message=Admin+access+required");

  return { demoMode: false, user };
}
