"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleFavourite(venueId: string, isSaved: boolean, pathname: string) {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Connect Supabase to save favourites." };

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "Sign in to save venues." };

  const query = supabase.from("favourites");
  const { error } = isSaved
    ? await query.delete().match({ venue_id: venueId, user_id: user.id })
    : await query.insert({ venue_id: venueId, user_id: user.id });

  if (error) return { ok: false, message: error.message };
  revalidatePath(pathname);
  return { ok: true, message: isSaved ? "Removed from favourites." : "Saved to favourites." };
}
