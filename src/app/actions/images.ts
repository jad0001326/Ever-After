"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function uploadVenueImage(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const venueId = formData.get("venueId")?.toString();
  const alt = formData.get("alt")?.toString() ?? "";
  const file = formData.get("image");

  if (!venueId) redirect("/admin?message=Missing+venue+id");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/admin/venues/${venueId}/edit?message=Choose+an+image+first`);
  }

  if (!supabase) redirect("/login?message=Configure+Supabase+environment+variables+first");
  if (!alt.trim()) redirect(`/admin/venues/${venueId}/edit?message=Alt+text+is+required`);

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const path = `${venueId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("venue-images").upload(path, file, {
    cacheControl: "31536000",
    upsert: false
  });

  if (uploadError) {
    redirect(`/admin/venues/${venueId}/edit?message=${encodeURIComponent(`${uploadError.message}. Check that the venue-images bucket exists and is public.`)}`);
  }

  const { data } = supabase.storage.from("venue-images").getPublicUrl(path);
  const { error } = await supabase.from("venue_images").insert({
    venue_id: venueId,
    url: data.publicUrl,
    alt,
    sort_order: 99
  });

  if (error) redirect(`/admin/venues/${venueId}/edit?message=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/venues/${venueId}/edit`);
  redirect(`/admin/venues/${venueId}/edit?message=Image+uploaded`);
}
