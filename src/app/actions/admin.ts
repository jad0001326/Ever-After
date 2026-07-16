"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { imageUrlOrRepresentative } from "@/lib/venue-images";
import { supplierCategorySlugFromLabel } from "@/data/supplier-directory";
import type { Database } from "@/types/database";

type VenueUpdate = Database["public"]["Tables"]["venues"]["Update"];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function venueFormPath(id?: string) {
  return id ? `/admin/venues/${id}/edit` : "/admin/venues/new";
}

function optionalPrice(value: FormDataEntryValue | null) {
  const input = value?.toString().trim();
  if (!input) return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function optionalHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function bulkUpdateVenues(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  if (!supabase) redirect("/login?message=Configure+Supabase+environment+variables+first");

  const ids = formData.getAll("venueIds").map((value) => value.toString()).filter(Boolean);
  const action = formData.get("bulkAction")?.toString();
  if (ids.length === 0) redirect("/admin?message=Select+at+least+one+venue");

  const updates: VenueUpdate = {};
  if (action === "publish") {
    updates.status = "published";
    updates.listing_status = "published";
  } else if (action === "draft") {
    updates.status = "draft";
    updates.listing_status = "draft";
  } else if (action === "archive") {
    updates.status = "draft";
    updates.listing_status = "archived";
  } else if (action === "feature") {
    updates.is_featured = true;
  } else if (action === "unfeature") {
    updates.is_featured = false;
  } else if (action === "mark_invite_sent") {
    updates.invite_status = "sent";
    updates.invite_sent_at = new Date().toISOString();
  } else if (action === "reset_invite") {
    updates.invite_status = "not_sent";
    updates.invite_sent_at = null;
  } else {
    redirect("/admin?message=Choose+a+bulk+action");
  }

  const { error } = await supabase.from("venues").update(updates).in("id", ids);
  if (error) redirect(`/admin?message=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin");
  revalidatePath("/venues");
  redirect(`/admin?message=${encodeURIComponent(`Updated ${ids.length} venue${ids.length === 1 ? "" : "s"}`)}`);
}

export async function updateVenueOutreach(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  if (!supabase) redirect("/login?message=Configure+Supabase+environment+variables+first");

  const venueId = formData.get("venueId")?.toString();
  const action = formData.get("outreachAction")?.toString();
  const notes = formData.get("outreachNotes")?.toString().trim() || null;
  if (!venueId) redirect("/admin/outreach?message=Venue+is+required");

  const updates: VenueUpdate = { outreach_notes: notes };
  if (action === "mark_sent") {
    updates.invite_status = "sent";
    updates.invite_sent_at = new Date().toISOString();
  } else if (action === "mark_replied") {
    updates.invite_status = "replied";
  } else if (action === "mark_bounced") {
    updates.invite_status = "bounced";
  } else if (action === "reset") {
    updates.invite_status = "not_sent";
    updates.invite_sent_at = null;
  } else if (action !== "save_notes") {
    redirect("/admin/outreach?message=Choose+an+outreach+action");
  }

  const { error } = await supabase.from("venues").update(updates).eq("id", venueId);
  if (error) redirect(`/admin/outreach?message=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin");
  revalidatePath("/admin/outreach");
  redirect("/admin/outreach?message=Outreach+updated");
}

export async function upsertVenue(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  if (!supabase) redirect("/login?message=Configure+Supabase+environment+variables+first");

  const id = formData.get("id")?.toString();
  const name = formData.get("name")?.toString() ?? "";
  const errorPath = venueFormPath(id);
  if (!name.trim()) redirect(`${errorPath}?message=Venue+name+is+required`);

  const status: "draft" | "published" = formData.get("status")?.toString() === "draft" ? "draft" : "published";
  const rawListingStatus = formData.get("listingStatus")?.toString() ?? "published";
  const listingStatus = (["draft", "published", "claimed", "archived"].includes(rawListingStatus) ? rawListingStatus : "published") as "draft" | "published" | "claimed" | "archived";
  const rawClaimStatus = formData.get("claimStatus")?.toString() ?? "unclaimed";
  const claimStatus = (["unclaimed", "pending", "approved", "rejected"].includes(rawClaimStatus) ? rawClaimStatus : "unclaimed") as "unclaimed" | "pending" | "approved" | "rejected";
  const rawInviteStatus = formData.get("inviteStatus")?.toString() ?? "not_sent";
  const inviteStatus = (["not_sent", "sent", "bounced", "replied", "claimed"].includes(rawInviteStatus) ? rawInviteStatus : "not_sent") as "not_sent" | "sent" | "bounced" | "replied" | "claimed";
  const type = formData.get("type")?.toString() ?? "Country Estate";
  const officialWebsiteUrl = formData.get("officialWebsiteUrl")?.toString().trim() || null;
  const officialGalleryUrl = formData.get("officialGalleryUrl")?.toString().trim() || null;
  const vendorContactEmail = formData.get("vendorContactEmail")?.toString().trim() || null;
  const vendorContactSourceInput = formData.get("vendorContactSourceUrl")?.toString().trim() || null;
  const vendorContactSourceUrl = optionalHttpUrl(vendorContactSourceInput);
  const originalVendorContactEmail = formData.get("originalVendorContactEmail")?.toString().trim().toLowerCase() || null;
  const originalVendorContactSourceUrl = formData.get("originalVendorContactSourceUrl")?.toString().trim() || null;
  const vendorContactChanged = vendorContactEmail?.toLowerCase() !== originalVendorContactEmail || vendorContactSourceUrl !== originalVendorContactSourceUrl;
  const imageCredit = formData.get("imageCredit")?.toString().trim() || null;
  const outreachNotes = formData.get("outreachNotes")?.toString().trim() || null;
  const imagePermissionStatus = formData.get("imagePermissionStatus")?.toString().trim() || "representative";
  const inviteSentAt = formData.get("inviteSentAt")?.toString().trim();
  const priceFrom = optionalPrice(formData.get("priceFrom"));
  const priceTo = optionalPrice(formData.get("priceTo")) ?? priceFrom;
  const capacityMin = Number(formData.get("capacityMin"));
  const capacityMax = Number(formData.get("capacityMax"));

  if (vendorContactSourceInput && !vendorContactSourceUrl) {
    redirect(`${errorPath}?message=Contact+source+must+be+a+valid+HTTP+or+HTTPS+URL`);
  }

  if (!Number.isFinite(capacityMin) || capacityMin < 1) {
    redirect(`${errorPath}?message=Capacity+minimum+must+be+at+least+1+guest`);
  }

  if (!Number.isFinite(capacityMax) || capacityMax < capacityMin) {
    redirect(`${errorPath}?message=Capacity+maximum+must+be+greater+than+or+equal+to+capacity+minimum`);
  }

  if (priceFrom != null && priceTo != null && priceTo < priceFrom) {
    redirect(`${errorPath}?message=Price+to+must+be+greater+than+or+equal+to+price+from`);
  }

  const payload = {
    slug: formData.get("slug")?.toString() || slugify(name),
    name,
    type,
    region: formData.get("region")?.toString() ?? "",
    town: formData.get("town")?.toString() ?? "",
    summary: formData.get("summary")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    price_from: priceFrom,
    price_to: priceTo,
    capacity_min: capacityMin,
    capacity_max: capacityMax,
    hero_image: imageUrlOrRepresentative(formData.get("heroImage")?.toString(), type),
    official_website_url: officialWebsiteUrl,
    official_gallery_url: officialGalleryUrl,
    vendor_contact_email: vendorContactEmail,
    vendor_contact_source_url: vendorContactEmail ? vendorContactSourceUrl : null,
    ...(vendorContactChanged ? { vendor_contact_verified_at: null, vendor_contact_verified_by: null } : {}),
    listing_status: listingStatus,
    claim_status: claimStatus,
    image_permission_status: imagePermissionStatus,
    image_credit: imageCredit,
    outreach_notes: outreachNotes,
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

  if (result.error) redirect(`${errorPath}?message=${encodeURIComponent(result.error.message)}`);

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

export async function reviewSupplierApplication(formData: FormData) {
  const { user } = await requireAdmin();
  const applicationId = formData.get("applicationId")?.toString().trim();
  const status = formData.get("status")?.toString();
  const adminNotes = formData.get("adminNotes")?.toString().trim().slice(0, 2_000) || null;

  if (!applicationId || (status !== "approved" && status !== "rejected")) {
    redirect("/admin/applications?message=Choose+a+valid+application+decision");
  }

  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/applications?message=Configure+the+Supabase+service+role+key+to+review+applications");

  const { data: application, error: applicationError } = await supabase
    .from("supplier_applications")
    .select("*")
    .eq("id", applicationId)
    .eq("status", "pending")
    .maybeSingle();

  if (applicationError || !application) redirect(`/admin/applications?message=${encodeURIComponent(applicationError?.message ?? "Application not found or already reviewed")}`);

  let draftCreated = false;
  const categorySlug = supplierCategorySlugFromLabel(application.category);
  if (status === "approved" && categorySlug) {
    const locationParts = application.location.split(",").map((part) => part.trim()).filter(Boolean);
    const baseTown = locationParts[0] ?? application.location;
    const region = locationParts.slice(1).join(", ") || baseTown;
    const baseSlug = slugify(application.business_name) || `supplier-${application.id.slice(0, 8)}`;
    const { data: slugOwner } = await supabase.from("supplier_listings").select("id, application_id").eq("slug", baseSlug).maybeSingle();
    const listingSlug = slugOwner && slugOwner.application_id !== application.id ? `${baseSlug}-${application.id.slice(0, 6)}` : baseSlug;
    const instagramUrl = application.instagram_handle
      ? optionalHttpUrl(application.instagram_handle) ?? `https://www.instagram.com/${application.instagram_handle.replace(/^@/, "").replace(/\/$/, "")}/`
      : null;
    const services = application.services.split(/[\n,]+/).map((service) => service.trim()).filter(Boolean);
    const { data: listing, error: listingError } = await supabase.from("supplier_listings").upsert({
      application_id: application.id,
      category_slug: categorySlug,
      slug: listingSlug,
      name: application.business_name,
      base_town: baseTown,
      region,
      country: "Scotland",
      service_areas: [application.location],
      travel_radius_miles: application.coverage_radius_miles,
      summary: application.description.slice(0, 500),
      description: application.description,
      services,
      official_website_url: optionalHttpUrl(application.website_url),
      instagram_url: instagramUrl,
      facebook_url: optionalHttpUrl(application.facebook_url),
      source_url: optionalHttpUrl(application.website_url),
      pricing_summary: application.pricing,
      listing_status: "draft",
      image_permission_status: "representative"
    }, { onConflict: "application_id" }).select("id").single();

    if (listingError || !listing) redirect(`/admin/applications?message=${encodeURIComponent(listingError?.message ?? "Draft supplier listing could not be created")}`);
    if (categorySlug === "photographer") {
      const { error: photographerError } = await supabase.from("photographer_profiles").upsert({ supplier_id: listing.id }, { onConflict: "supplier_id" });
      if (photographerError) redirect(`/admin/applications?message=${encodeURIComponent(photographerError.message)}`);
    }
    draftCreated = true;
  }

  const { error } = await supabase
    .from("supplier_applications")
    .update({ status, admin_notes: adminNotes, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq("id", applicationId)
    .eq("status", "pending");

  if (error) redirect(`/admin/applications?message=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/applications");
  revalidatePath("/admin/suppliers");
  redirect(`/admin/applications?message=${encodeURIComponent(draftCreated ? "Application approved and a draft supplier profile was created" : `Application ${status}`)}`);
}
