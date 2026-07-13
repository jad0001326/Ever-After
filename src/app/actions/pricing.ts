"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEligibleVenueSummaryPrice } from "@/lib/venue-pricing";
import type { Database } from "@/types/database";

type PricingClient = NonNullable<ReturnType<typeof createAdminClient>>;
type PriceKind = Database["public"]["Enums"]["venue_price_kind"];
type PriceUnit = Database["public"]["Enums"]["venue_price_unit"];
type PriceQualifier = Database["public"]["Enums"]["venue_price_qualifier"];
type PriceSourceType = Database["public"]["Enums"]["venue_price_source_type"];
type VerificationMethod = Database["public"]["Enums"]["venue_price_verification_method"];
type PriceInsert = Database["public"]["Tables"]["venue_price_options"]["Insert"];

const PRICE_KINDS = new Set<PriceKind>([
  "venue_hire",
  "exclusive_use",
  "wedding_package",
  "per_person",
  "ceremony_fee",
  "catering",
  "accommodation",
  "minimum_spend",
  "quote_required",
  "other"
]);
const PRICE_UNITS = new Set<PriceUnit>(["total", "per_person", "per_night", "per_room", "per_event", "per_hour", "unspecified", "quote"]);
const PRICE_QUALIFIERS = new Set<PriceQualifier>(["from", "fixed", "range", "quote"]);
const SOURCE_TYPES = new Set<PriceSourceType>(["official_website", "official_brochure", "venue_confirmed", "admin_verified", "other"]);

type PriceRow = {
  kind: string;
  pricing_unit: string;
  amount_from_pence: number | null;
  amount_to_pence: number | null;
  tax_label: string | null;
  valid_to: string | null;
};

export async function saveVenuePriceOption(formData: FormData) {
  const { user } = await requireAdmin();
  const database = requirePricingClient();
  const venueId = requiredValue(formData, "venueId", 128);
  const optionId = optionalValue(formData, "optionId", 128);
  const venueSlug = requiredValue(formData, "venueSlug", 180);
  const kind = allowedValue(formData, "kind", PRICE_KINDS, "other");
  const requestedUnit = allowedValue(formData, "pricingUnit", PRICE_UNITS, "total");
  const pricingUnit = kind === "quote_required" ? "quote" : requestedUnit === "quote" ? "total" : requestedUnit;
  const requestedQualifier = allowedValue(formData, "priceQualifier", PRICE_QUALIFIERS, "from");
  const label = requiredValue(formData, "label", 160);
  const status = formData.get("status")?.toString() === "published" ? "published" : "draft";
  const amountFromPence = kind === "quote_required" ? null : moneyToPence(formData.get("amountFrom"));
  const amountToPence = kind === "quote_required" ? null : moneyToPence(formData.get("amountTo"));
  const sourceType = allowedValue(formData, "sourceType", SOURCE_TYPES, "other");
  const sourceUrlInput = optionalValue(formData, "sourceUrl", 2_000);
  const sourceUrl = sourceUrlInput ? safeHttpUrl(sourceUrlInput) : null;
  const sourceTitle = optionalValue(formData, "sourceTitle", 300);
  const description = optionalValue(formData, "description", 4_000);
  const taxLabel = optionalValue(formData, "taxLabel", 80);
  const minimumNights = optionalInteger(formData.get("minimumNights"), 1, 365);
  const evidenceText = optionalValue(formData, "evidenceText", 4_000);
  const includedGuests = optionalInteger(formData.get("includedGuests"), 1, 10_000);
  const displayPriority = optionalInteger(formData.get("displayPriority"), 0, 10_000) ?? 100;
  const seasonLabel = optionalValue(formData, "seasonLabel", 120);
  const dayLabel = optionalValue(formData, "dayLabel", 120);
  const validFrom = optionalIsoDate(formData.get("validFrom"));
  const validTo = optionalIsoDate(formData.get("validTo"));
  const now = new Date().toISOString();
  const priceQualifier: PriceQualifier = kind === "quote_required" ? "quote" : requestedQualifier;

  if (kind !== "quote_required" && amountFromPence == null) returnToVenue(venueId, "Add a valid starting price greater than zero.");
  if (kind !== "quote_required" && priceQualifier === "quote") returnToVenue(venueId, "Quote is only valid for contact-for-pricing options.");
  if (amountFromPence != null && amountToPence != null && amountToPence <= amountFromPence) {
    returnToVenue(venueId, "A price range needs an upper amount greater than the starting price.");
  }
  if (kind !== "quote_required" && priceQualifier === "range" && amountToPence == null) returnToVenue(venueId, "Add an upper amount for a price range.");
  if (kind !== "quote_required" && priceQualifier !== "range" && amountToPence != null) returnToVenue(venueId, "Choose the range qualifier when adding an upper amount.");
  if (validFrom === undefined || validTo === undefined) returnToVenue(venueId, "Use a valid pricing date.");
  if (validFrom && validTo && validTo < validFrom) returnToVenue(venueId, "The valid-until date cannot be before the valid-from date.");
  if (sourceUrlInput && !sourceUrl) returnToVenue(venueId, "The pricing source must be a valid public HTTP or HTTPS URL.");
  if (["official_website", "official_brochure"].includes(sourceType) && !sourceUrl) {
    returnToVenue(venueId, "Official pricing needs the exact source page or brochure URL.");
  }
  if (status === "published" && !evidenceText) {
    returnToVenue(venueId, "Add a short evidence note before publishing this price.");
  }

  const payload: PriceInsert = {
    venue_id: venueId,
    kind,
    label,
    amount_from_pence: amountFromPence,
    amount_to_pence: amountToPence,
    currency: "GBP",
    pricing_unit: pricingUnit,
    price_qualifier: priceQualifier,
    included_guests: includedGuests,
    season_label: seasonLabel,
    day_label: dayLabel,
    description,
    tax_label: taxLabel,
    minimum_nights: minimumNights,
    valid_from: validFrom,
    valid_to: validTo,
    source_type: sourceType,
    source_url: sourceUrl,
    source_title: sourceTitle,
    evidence_text: evidenceText,
    last_checked_at: status === "published" ? now : null,
    verification_method: status === "published" ? verificationMethod(sourceType) : null,
    verified_at: status === "published" ? now : null,
    verified_by: status === "published" ? user.id : null,
    status,
    published_at: status === "published" ? now : null,
    superseded_at: null,
    superseded_by: null,
    display_priority: displayPriority,
    updated_by: user.id,
    ...(optionId ? {} : { created_by: user.id })
  };

  const result = optionId
    ? await database.from("venue_price_options").update(payload).eq("id", optionId).eq("venue_id", venueId).select("id").maybeSingle()
    : await database.from("venue_price_options").insert(payload).select("id").single();
  if (result.error) returnToVenue(venueId, result.error.message);
  if (!result.data) returnToVenue(venueId, "This price changed while you were editing it. Reload and try again.");

  await syncVenuePriceSummary(database, venueId);
  revalidateVenuePricing(venueId, venueSlug);
  redirect(`/admin/venues/${venueId}/edit?message=${encodeURIComponent(status === "published" ? "Verified price published" : "Price saved as a private draft")}`);
}

export async function supersedeVenuePriceOption(formData: FormData) {
  const { user } = await requireAdmin();
  const database = requirePricingClient();
  const venueId = requiredValue(formData, "venueId", 128);
  const optionId = requiredValue(formData, "optionId", 128);
  const venueSlug = requiredValue(formData, "venueSlug", 180);
  const now = new Date().toISOString();
  const { data, error } = await database
    .from("venue_price_options")
    .update({ status: "superseded", superseded_at: now, updated_by: user.id })
    .eq("id", optionId)
    .eq("venue_id", venueId)
    .eq("status", "published")
    .select("id")
    .maybeSingle();
  if (error) returnToVenue(venueId, error.message);
  if (!data) returnToVenue(venueId, "Only a currently published price can be superseded.");
  await syncVenuePriceSummary(database, venueId);
  revalidateVenuePricing(venueId, venueSlug);
  redirect(`/admin/venues/${venueId}/edit?message=Price+superseded`);
}

export async function deleteVenuePriceDraft(formData: FormData) {
  await requireAdmin();
  const database = requirePricingClient();
  const venueId = requiredValue(formData, "venueId", 128);
  const optionId = requiredValue(formData, "optionId", 128);
  const venueSlug = requiredValue(formData, "venueSlug", 180);
  const { data, error } = await database
    .from("venue_price_options")
    .delete()
    .eq("id", optionId)
    .eq("venue_id", venueId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) returnToVenue(venueId, error.message);
  if (!data) returnToVenue(venueId, "Only a private draft can be deleted.");
  revalidateVenuePricing(venueId, venueSlug);
  redirect(`/admin/venues/${venueId}/edit?message=Pricing+draft+deleted`);
}

async function syncVenuePriceSummary(database: PricingClient, venueId: string) {
  const { data, error } = await database
    .from("venue_price_options")
    .select("kind, pricing_unit, amount_from_pence, amount_to_pence, tax_label, valid_to")
    .eq("venue_id", venueId)
    .eq("status", "published")
    .order("display_priority", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PriceRow[];
  const today = new Date().toISOString().slice(0, 10);
  const comparable = rows.find((row) => isEligibleVenueSummaryPrice({
    kind: row.kind,
    pricingUnit: row.pricing_unit,
    amountFromPence: row.amount_from_pence,
    taxLabel: row.tax_label,
    validTo: row.valid_to
  }, today));
  const { error: venueError } = await database.from("venues").update({
    price_from: comparable?.amount_from_pence == null ? null : Math.ceil(comparable.amount_from_pence / 100),
    price_to: comparable?.amount_to_pence == null ? null : Math.ceil(comparable.amount_to_pence / 100)
  }).eq("id", venueId);
  if (venueError) throw new Error(venueError.message);
}

function requirePricingClient() {
  const client = createAdminClient();
  if (!client) redirect("/admin?message=Configure+SUPABASE_SERVICE_ROLE_KEY+before+managing+pricing");
  return client;
}

function requiredValue(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key)?.toString().trim() ?? "";
  if (!value || value.length > maxLength) redirect("/admin?message=The+pricing+request+is+invalid");
  return value;
}

function optionalValue(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key)?.toString().trim() ?? "";
  return value ? value.slice(0, maxLength) : null;
}

function allowedValue<T extends string>(formData: FormData, key: string, allowed: ReadonlySet<T>, fallback: T): T {
  const value = formData.get(key)?.toString().trim() ?? "";
  return allowed.has(value as T) ? value as T : fallback;
}

function optionalInteger(value: FormDataEntryValue | null, minimum: number, maximum: number) {
  const input = value?.toString().trim();
  if (!input) return null;
  const parsed = Number(input);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function optionalIsoDate(value: FormDataEntryValue | null) {
  const input = value?.toString().trim();
  if (!input) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return undefined;
  const date = new Date(`${input}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === input ? input : undefined;
}

function moneyToPence(value: FormDataEntryValue | null) {
  const input = value?.toString().trim();
  if (!input) return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000 ? Math.round(parsed * 100) : null;
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function verificationMethod(sourceType: PriceSourceType): VerificationMethod {
  if (["official_website", "official_brochure"].includes(sourceType)) return "official_source";
  if (sourceType === "venue_confirmed") return "venue_confirmation";
  return "admin_review";
}

function returnToVenue(venueId: string, message: string): never {
  redirect(`/admin/venues/${venueId}/edit?message=${encodeURIComponent(message)}`);
}

function revalidateVenuePricing(venueId: string, venueSlug: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/venues/${venueId}/edit`);
  revalidatePath("/venues");
  revalidatePath(`/venues/${venueSlug}`);
  revalidatePath("/wedding-budget-planner");
}
