"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supplierDirectoryCategories } from "@/data/supplier-directory";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function text(formData: FormData, key: string) { return formData.get(key)?.toString().trim() ?? ""; }
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function lines(value: string) { return [...new Set(value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean))]; }
function optionalNumber(value: string) { if (!value) return null; const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : null; }
function pricePence(value: string) { const number = optionalNumber(value); return number == null ? null : Math.round(number * 100); }
function optionalUrl(value: string) {
  if (!value) return null;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null; } catch { return null; }
}

export async function saveSupplierListing(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();
  if (!supabase) redirect("/admin/suppliers?message=Configure+the+Supabase+service+role+key+first");

  const id = text(formData, "id") || null;
  const name = text(formData, "name");
  const categorySlug = text(formData, "categorySlug");
  const baseTown = text(formData, "baseTown");
  const region = text(formData, "region");
  const listingStatus = text(formData, "listingStatus");
  const safeListingStatus: "draft" | "published" | "archived" = listingStatus === "published" || listingStatus === "archived" ? listingStatus : "draft";
  const summary = text(formData, "summary");
  const description = text(formData, "description");
  const website = optionalUrl(text(formData, "officialWebsiteUrl"));
  const heroImageUrl = optionalUrl(text(formData, "heroImageUrl"));
  const imageRightsApproved = formData.get("imageRightsApproved") === "on";

  if (!name || !baseTown || !region || !supplierDirectoryCategories.some((category) => category.slug === categorySlug)) redirect(`${id ? `/admin/suppliers/${id}/edit` : "/admin/suppliers/new"}?message=Complete+the+required+supplier+fields`);
  if (!website && text(formData, "officialWebsiteUrl")) redirect(`${id ? `/admin/suppliers/${id}/edit` : "/admin/suppliers/new"}?message=Use+a+valid+official+website+URL`);
  if (heroImageUrl && !imageRightsApproved) redirect(`${id ? `/admin/suppliers/${id}/edit` : "/admin/suppliers/new"}?message=Confirm+image+display+rights+before+adding+a+hero+image`);
  if (listingStatus === "published" && (summary.length < 40 || description.length < 80 || !website)) redirect(`${id ? `/admin/suppliers/${id}/edit` : "/admin/suppliers/new"}?message=Published+profiles+need+a+website%2C+a+40-character+summary+and+an+80-character+description`);

  const slugInput = slugify(text(formData, "slug") || name);
  const slug = slugInput || `supplier-${crypto.randomUUID().slice(0, 8)}`;
  const startingPricePence = pricePence(text(formData, "startingPrice"));
  const typicalPricePence = pricePence(text(formData, "typicalPrice"));
  const pricingUnitInput = text(formData, "pricingUnit");
  const pricingUnit: "package" | "hour" | "person" | "item" | "event" | "quote" = ["package", "hour", "person", "item", "event", "quote"].includes(pricingUnitInput) ? pricingUnitInput as "package" | "hour" | "person" | "item" | "event" | "quote" : "package";
  if (startingPricePence != null && typicalPricePence != null && typicalPricePence < startingPricePence) redirect(`${id ? `/admin/suppliers/${id}/edit` : "/admin/suppliers/new"}?message=Typical+price+cannot+be+lower+than+the+starting+price`);

  const payload = {
    category_slug: categorySlug,
    slug,
    name,
    base_town: baseTown,
    region,
    country: text(formData, "country") || "Scotland",
    service_areas: lines(text(formData, "serviceAreas")),
    travel_radius_miles: optionalNumber(text(formData, "travelRadiusMiles")),
    travels_nationwide: formData.get("travelsNationwide") === "on",
    summary,
    description,
    services: lines(text(formData, "services")),
    official_website_url: website,
    instagram_url: optionalUrl(text(formData, "instagramUrl")),
    facebook_url: optionalUrl(text(formData, "facebookUrl")),
    enquiry_url: optionalUrl(text(formData, "enquiryUrl")),
    source_url: optionalUrl(text(formData, "sourceUrl")),
    starting_price_pence: startingPricePence,
    typical_price_pence: typicalPricePence,
    pricing_summary: text(formData, "pricingSummary") || null,
    pricing_unit: pricingUnit,
    hero_image_url: heroImageUrl,
    image_credit: text(formData, "imageCredit") || null,
    image_permission_status: heroImageUrl ? "approved" as const : "representative" as const,
    listing_status: safeListingStatus,
    is_featured: formData.get("isFeatured") === "on",
    published_at: listingStatus === "published" ? new Date().toISOString() : null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id
  };

  const result = id
    ? await supabase.from("supplier_listings").update(payload).eq("id", id).select("id, slug").single()
    : await supabase.from("supplier_listings").insert(payload).select("id, slug").single();
  if (result.error || !result.data) redirect(`${id ? `/admin/suppliers/${id}/edit` : "/admin/suppliers/new"}?message=${encodeURIComponent(result.error?.message ?? "Supplier could not be saved")}`);

  if (categorySlug === "photographer") {
    const { error } = await supabase.from("photographer_profiles").upsert({
      supplier_id: result.data.id,
      styles: formData.getAll("styles").map((style) => style.toString()),
      coverage_hours_min: optionalNumber(text(formData, "coverageHoursMin")),
      coverage_hours_max: optionalNumber(text(formData, "coverageHoursMax")),
      second_photographer_available: formData.get("secondPhotographerAvailable") === "on",
      engagement_shoot_available: formData.get("engagementShootAvailable") === "on",
      drone_available: formData.get("droneAvailable") === "on",
      film_photography_available: formData.get("filmPhotographyAvailable") === "on",
      albums_available: formData.get("albumsAvailable") === "on",
      turnaround_weeks_min: optionalNumber(text(formData, "turnaroundWeeksMin")),
      turnaround_weeks_max: optionalNumber(text(formData, "turnaroundWeeksMax"))
    }, { onConflict: "supplier_id" });
    if (error) redirect(`/admin/suppliers/${result.data.id}/edit?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/suppliers");
  revalidatePath("/photographers");
  revalidatePath(`/photographers/${result.data.slug}`);
  revalidatePath("/wedding-budget-planner");
  redirect(`/admin/suppliers/${result.data.id}/edit?message=Supplier+profile+saved`);
}
