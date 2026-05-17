"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type VendorUpdateState = { ok: boolean; message: string } | null;

function field(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() ?? "";
}

export async function requestVenueUpdate(_: VendorUpdateState, formData: FormData): Promise<VendorUpdateState> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Supabase is not configured, so update requests cannot be stored yet." };

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "Sign in to request listing updates." };

  const venueId = field(formData, "venueId");
  const message = field(formData, "requestedMessage");
  if (!venueId || !message) return { ok: false, message: "Add a note explaining what should be reviewed." };

  const { data: venue } = await supabase
    .from("venues")
    .select("id, slug, claimed_by")
    .eq("id", venueId)
    .eq("is_claimed", true)
    .single();

  if (!venue || venue.claimed_by !== user.id) return { ok: false, message: "Only the approved claimant can request updates for this listing." };

  const { error } = await supabase.from("vendor_update_requests").insert({
    venue_id: venueId,
    vendor_user_id: user.id,
    requested_name: field(formData, "name") || null,
    requested_summary: field(formData, "summary") || null,
    requested_description: field(formData, "description") || null,
    requested_official_website_url: field(formData, "officialWebsiteUrl") || null,
    requested_official_gallery_url: field(formData, "officialGalleryUrl") || null,
    requested_message: message,
    status: "pending"
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/vendor");
  revalidatePath(`/venues/${venue.slug}`);
  return { ok: true, message: "Your update request has been sent for admin review." };
}
