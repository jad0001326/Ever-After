import type { Database } from "@/types/database";

type PricingUnit = Database["public"]["Tables"]["supplier_update_requests"]["Row"]["proposed_pricing_unit"];
type Proposal = Omit<Database["public"]["Tables"]["supplier_update_requests"]["Insert"], "supplier_id" | "submitted_by">;

export type SupplierOwnerUpdateInput = Record<string, string | boolean | undefined>;
export type SupplierOwnerUpdateResult = { ok: true; proposal: Proposal } | { ok: false; message: string };

const pricingUnits = new Set<PricingUnit>(["package", "hour", "person", "item", "event", "quote"]);

export function parseSupplierOwnerUpdate(input: SupplierOwnerUpdateInput): SupplierOwnerUpdateResult {
  const baseTown = text(input.baseTown);
  const region = text(input.region);
  const summary = text(input.summary);
  const description = text(input.description);
  const services = list(input.services);
  const serviceAreas = list(input.serviceAreas);
  const requestedMessage = text(input.requestedMessage);
  const pricingUnit = text(input.pricingUnit) as PricingUnit;

  if (!baseTown || baseTown.length > 120) return fail("Add a valid base town.");
  if (!region || region.length > 120) return fail("Add a valid region.");
  if (serviceAreas.length > 50) return fail("Add no more than 50 service areas.");
  if (serviceAreas.some((item) => item.length > 120) || serviceAreas.join(",").length > 4000) return fail("Keep each service area under 120 characters.");
  if (summary.length < 20 || summary.length > 320) return fail("Write a summary between 20 and 320 characters.");
  if (description.length < 40 || description.length > 5000) return fail("Write a description between 40 and 5,000 characters.");
  if (services.length < 1 || services.length > 30) return fail("Add between 1 and 30 services.");
  if (services.some((item) => item.length > 200) || services.join(",").length > 3000) return fail("Keep each service description under 200 characters.");
  if (requestedMessage.length < 10 || requestedMessage.length > 2000) return fail("Add a short review note explaining the changes.");
  if (!pricingUnits.has(pricingUnit)) return fail("Choose a valid pricing unit.");

  const urls = {
    proposed_official_website_url: optionalUrl(input.officialWebsiteUrl),
    proposed_instagram_url: optionalUrl(input.instagramUrl),
    proposed_facebook_url: optionalUrl(input.facebookUrl),
    proposed_enquiry_url: optionalUrl(input.enquiryUrl)
  };
  if (Object.values(urls).some((value) => value === false)) return fail("Links must be complete http or https URLs.");

  const startingPrice = poundsToPence(input.startingPrice);
  const typicalPrice = poundsToPence(input.typicalPrice);
  if (startingPrice === false || typicalPrice === false) return fail("Prices must be positive amounts with no more than two decimal places.");
  if (startingPrice != null && typicalPrice != null && typicalPrice < startingPrice) return fail("Typical price cannot be lower than the starting price.");

  return {
    ok: true,
    proposal: {
      proposed_base_town: baseTown,
      proposed_region: region,
      proposed_service_areas: serviceAreas,
      proposed_travels_nationwide: input.travelsNationwide === true || input.travelsNationwide === "on",
      proposed_summary: summary,
      proposed_description: description,
      proposed_services: services,
      proposed_official_website_url: urls.proposed_official_website_url || null,
      proposed_instagram_url: urls.proposed_instagram_url || null,
      proposed_facebook_url: urls.proposed_facebook_url || null,
      proposed_enquiry_url: urls.proposed_enquiry_url || null,
      proposed_starting_price_pence: startingPrice,
      proposed_typical_price_pence: typicalPrice,
      proposed_pricing_summary: text(input.pricingSummary).slice(0, 600) || null,
      proposed_pricing_unit: pricingUnit,
      requested_message: requestedMessage,
      status: "pending"
    }
  };
}

function text(value: string | boolean | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: string | boolean | undefined) {
  return Array.from(new Set(text(value).split(/[\n,]/).map((item) => item.trim()).filter(Boolean)));
}

function optionalUrl(value: string | boolean | undefined): string | null | false {
  const candidate = text(value);
  if (!candidate) return null;
  if (candidate.length > 1000) return false;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : false;
  } catch {
    return false;
  }
}

function poundsToPence(value: string | boolean | undefined): number | null | false {
  const candidate = text(value).replace(/^£/, "");
  if (!candidate) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(candidate)) return false;
  const pence = Math.round(Number(candidate) * 100);
  return Number.isSafeInteger(pence) && pence >= 0 && pence <= 2_147_483_647 ? pence : false;
}

function fail(message: string): SupplierOwnerUpdateResult {
  return { ok: false, message };
}
