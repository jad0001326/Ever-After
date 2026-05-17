"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function upsertVenue(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  if (!supabase) redirect("/login?message=Configure+Supabase+environment+variables+first");

  const id = formData.get("id")?.toString();
  const name = formData.get("name")?.toString() ?? "";
  if (!name.trim()) redirect("/admin?message=Venue+name+is+required");

  const status: "draft" | "published" = formData.get("status")?.toString() === "draft" ? "draft" : "published";
  const rawListingStatus = formData.get("listingStatus")?.toString() ?? "published";
  const listingStatus = (["draft", "published", "claimed", "archived"].includes(rawListingStatus) ? rawListingStatus : "published") as "draft" | "published" | "claimed" | "archived";
  const rawClaimStatus = formData.get("claimStatus")?.toString() ?? "unclaimed";
  const claimStatus = (["unclaimed", "pending", "approved", "rejected"].includes(rawClaimStatus) ? rawClaimStatus : "unclaimed") as "unclaimed" | "pending" | "approved" | "rejected";
  const rawInviteStatus = formData.get("inviteStatus")?.toString() ?? "not_sent";
  const inviteStatus = (["not_sent", "sent", "bounced", "replied", "claimed"].includes(rawInviteStatus) ? rawInviteStatus : "not_sent") as "not_sent" | "sent" | "bounced" | "replied" | "claimed";
  const officialWebsiteUrl = formData.get("officialWebsiteUrl")?.toString().trim() || null;
  const officialGalleryUrl = formData.get("officialGalleryUrl")?.toString().trim() || null;
  const vendorContactEmail = formData.get("vendorContactEmail")?.toString().trim() || null;
  const imageCredit = formData.get("imageCredit")?.toString().trim() || null;
  const imagePermissionStatus = formData.get("imagePermissionStatus")?.toString().trim() || "representative";
  const inviteSentAt = formData.get("inviteSentAt")?.toString().trim();
  const payload = {
    slug: formData.get("slug")?.toString() || slugify(name),
    name,
    type: formData.get("type")?.toString() ?? "Country Estate",
    region: formData.get("region")?.toString() ?? "",
    town: formData.get("town")?.toString() ?? "",
    summary: formData.get("summary")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    price_from: Number(formData.get("priceFrom")) || 0,
    price_to: Number(formData.get("priceTo")) || 0,
    capacity_min: Number(formData.get("capacityMin")) || 0,
    capacity_max: Number(formData.get("capacityMax")) || 0,
    hero_image: formData.get("heroImage")?.toString() ?? "",
    official_website_url: officialWebsiteUrl,
    official_gallery_url: officialGalleryUrl,
    vendor_contact_email: vendorContactEmail,
    listing_status: listingStatus,
    claim_status: claimStatus,
    image_permission_status: imagePermissionStatus,
    image_credit: imageCredit,
    image_is_representative: formData.get("imageIsRepresentative") === "on",
    invite_status: inviteStatus,
    invite_sent_at: inviteSentAt ? new Date(inviteSentAt).toISOString() : null,
    is_featured: formData.get("isFeatured") === "on",
    status
  };

  const selectedAmenityIds = formData.getAll("amenities").map((value) => value.toString()).filter(Boolean);
  const result = id
    ? await supabase.from("venues").update(payload).eq("id", id).select("id").single()
    : await supabase.from("venues").insert(payload).select("id").single();

  if (result.error) redirect(`/admin?message=${encodeURIComponent(result.error.message)}`);

  const venueId = result.data.id;
  const { error: deleteError } = await supabase.from("venue_amenities").delete().eq("venue_id", venueId);
  if (deleteError) redirect(`/admin/venues/${venueId}/edit?message=${encodeURIComponent(deleteError.message)}`);

  if (selectedAmenityIds.length > 0) {
    const { error: amenitiesError } = await supabase.from("venue_amenities").insert(
      selectedAmenityIds.map((amenityId) => ({
        venue_id: venueId,
        amenity_id: amenityId
      }))
    );
    if (amenitiesError) redirect(`/admin/venues/${venueId}/edit?message=${encodeURIComponent(amenitiesError.message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/venues");
  revalidatePath(`/venues/${payload.slug}`);
  redirect(`/admin/venues/${venueId}/edit?message=Venue+saved`);
}
