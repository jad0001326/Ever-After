import { supplierDirectoryCategories } from "@/data/supplier-directory";

export type SupplierCandidateSourceType = "official_website" | "public_business_registry" | "supplier_submitted" | "other_public_source";
export type SupplierCandidateImageStatus = "not_provided" | "pending" | "approved" | "rejected";
export type SupplierCandidatePricingUnit = "package" | "hour" | "person" | "item" | "event" | "quote";

export type SupplierCandidate = {
  row_number: number;
  identity_key: string;
  category_slug: string;
  slug: string;
  business_name: string;
  base_town: string;
  region: string;
  country: string;
  service_areas: string[];
  travels_nationwide: boolean;
  summary: string;
  description: string;
  services: string[];
  official_website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  enquiry_url: string | null;
  starting_price_pence: number | null;
  typical_price_pence: number | null;
  pricing_summary: string | null;
  pricing_unit: SupplierCandidatePricingUnit;
  hero_image_url: string | null;
  image_credit: string | null;
  image_permission_status: SupplierCandidateImageStatus;
  image_permission_evidence_url: string | null;
  source_url: string;
  source_type: SupplierCandidateSourceType;
  researched_at: string;
  review_notes: string | null;
};

export type SupplierImportIssue = { row: number; business?: string; message: string };
export type SupplierImportParseResult = { candidates: SupplierCandidate[]; errors: SupplierImportIssue[]; warnings: SupplierImportIssue[] };
export type SupplierImportReadiness = {
  acceptanceReadyRows: number;
  manualReviewRows: number;
  validRows: number;
};

type RawRow = Record<string, string>;
const categorySlugs = new Set<string>(supplierDirectoryCategories.map((category) => category.slug));
const sourceTypes = new Set<SupplierCandidateSourceType>(["official_website", "public_business_registry", "supplier_submitted", "other_public_source"]);
const pricingUnits = new Set<SupplierCandidatePricingUnit>(["package", "hour", "person", "item", "event", "quote"]);
const imageStatuses = new Set<SupplierCandidateImageStatus>(["not_provided", "pending", "approved", "rejected"]);

export function getSupplierImportReadiness(candidates: readonly SupplierCandidate[]): SupplierImportReadiness {
  let manualReviewRows = 0;
  for (const candidate of candidates) {
    if (candidate.review_notes) manualReviewRows += 1;
  }
  return {
    acceptanceReadyRows: candidates.length - manualReviewRows,
    manualReviewRows,
    validRows: candidates.length,
  };
}

export function formatSupplierImportReadiness(readiness: SupplierImportReadiness) {
  if (readiness.manualReviewRows === 0) {
    return readiness.acceptanceReadyRows === 1
      ? "The structurally valid row has no manual-review note."
      : `All ${readiness.acceptanceReadyRows} structurally valid rows have no manual-review note.`;
  }
  const readyVerb = readiness.acceptanceReadyRows === 1 ? "has" : "have";
  const reviewVerb = readiness.manualReviewRows === 1 ? "requires" : "require";
  return `${readiness.acceptanceReadyRows} ${readyVerb} no manual-review note; ${readiness.manualReviewRows} ${reviewVerb} a recorded resolution before acceptance.`;
}

export function parseSupplierCandidateRows(rows: string[][], defaultResearchDate: string, today = new Date().toISOString().slice(0, 10)): SupplierImportParseResult {
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeHeader(cell) === "businessname"));
  if (headerIndex < 0) return { candidates: [], errors: [{ row: 0, message: "Could not find a Business name header." }], warnings: [] };
  const headers = rows[headerIndex].map(normalizeHeader);
  const candidates: SupplierCandidate[] = [];
  const errors: SupplierImportIssue[] = [];
  const warnings: SupplierImportIssue[] = [];
  const seenSlugs = new Set<string>();

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const rowNumber = index + 1;
    const raw = Object.fromEntries(headers.map((header, cell) => [header, rows[index]?.[cell]?.trim() ?? ""])) as RawRow;
    if (!Object.values(raw).some(Boolean)) continue;
    const business = value(raw, "Business name");
    const rowErrors: string[] = [];
    const categorySlug = value(raw, "Category").toLowerCase();
    const slug = slugify(value(raw, "Slug") || business);
    const baseTown = value(raw, "Base town");
    const region = value(raw, "Region");
    const summary = value(raw, "Summary");
    const description = value(raw, "Description");
    const services = list(value(raw, "Services"));
    const serviceAreas = list(value(raw, "Service areas"));
    const officialWebsiteInput = value(raw, "Official website URL");
    const officialWebsite = httpUrl(officialWebsiteInput, true);
    const sourceUrl = httpUrl(value(raw, "Source URL"));
    const sourceType = value(raw, "Source type").toLowerCase() as SupplierCandidateSourceType;
    const researchedAt = value(raw, "Research date") || defaultResearchDate;
    const pricingUnitInput = value(raw, "Pricing unit").toLowerCase() as SupplierCandidatePricingUnit;
    const pricingUnit = pricingUnits.has(pricingUnitInput) ? pricingUnitInput : "quote";
    const startingPrice = poundsToPence(value(raw, "Starting price"));
    const typicalPrice = poundsToPence(value(raw, "Typical price"));
    const pricingSummary = value(raw, "Pricing summary") || null;
    const instagramInput = value(raw, "Instagram URL");
    const facebookInput = value(raw, "Facebook URL");
    const enquiryInput = value(raw, "Enquiry URL");
    const instagramUrl = httpUrl(instagramInput, true);
    const facebookUrl = httpUrl(facebookInput, true);
    const enquiryUrl = httpUrl(enquiryInput, true);
    const heroImage = httpUrl(value(raw, "Hero image URL"), true);
    const imageStatusInput = value(raw, "Image permission status").toLowerCase().replace(/\s+/g, "_") as SupplierCandidateImageStatus;
    const imageStatus = heroImage ? (imageStatuses.has(imageStatusInput) && imageStatusInput !== "not_provided" ? imageStatusInput : "pending") : "not_provided";
    const imageEvidence = httpUrl(value(raw, "Image permission evidence URL"), true);
    const imageCredit = value(raw, "Image credit") || null;
    const reviewNotes = value(raw, "Review notes") || null;

    if (!business || business.length > 160) rowErrors.push("Business name is required and must be under 160 characters.");
    if (!categorySlugs.has(categorySlug)) rowErrors.push("Category must match a configured supplier category slug.");
    if (!slug) rowErrors.push("A usable slug could not be generated.");
    if (seenSlugs.has(slug)) rowErrors.push("Slug is duplicated within this file.");
    if (!baseTown || baseTown.length > 120) rowErrors.push("Base town is required and must be under 120 characters.");
    if (!region || region.length > 120) rowErrors.push("Region is required and must be under 120 characters.");
    if ((value(raw, "Country") || "Scotland").length > 120) rowErrors.push("Country must be under 120 characters.");
    if (summary.length < 20 || summary.length > 500) rowErrors.push("Summary must be between 20 and 500 characters.");
    if (description.length < 40 || description.length > 5000) rowErrors.push("Description must be between 40 and 5,000 characters.");
    if (services.length < 1 || services.length > 30 || services.some((item) => item.length > 200)) rowErrors.push("Add between 1 and 30 services, each under 200 characters.");
    if (serviceAreas.length > 50 || serviceAreas.some((item) => item.length > 120)) rowErrors.push("Add no more than 50 service areas, each under 120 characters.");
    if (officialWebsiteInput && !officialWebsite) rowErrors.push("Official website URL must be http or https.");
    if (!officialWebsite && !instagramUrl && !facebookUrl && !enquiryUrl) rowErrors.push("Add at least one official public website, social profile or enquiry URL.");
    if (!sourceUrl) rowErrors.push("A valid public source URL is required.");
    if (instagramInput && !instagramUrl) rowErrors.push("Instagram URL must be http or https.");
    if (facebookInput && !facebookUrl) rowErrors.push("Facebook URL must be http or https.");
    if (enquiryInput && !enquiryUrl) rowErrors.push("Enquiry URL must be http or https.");
    if (!sourceTypes.has(sourceType)) rowErrors.push("Source type must be official_website, public_business_registry, supplier_submitted or other_public_source.");
    if (!isDate(researchedAt) || researchedAt > today) rowErrors.push("Research date must be a valid date that is not in the future.");
    if (startingPrice === false || typicalPrice === false) rowErrors.push("Prices must be positive GBP amounts with no more than two decimal places.");
    if (typeof startingPrice === "number" && typeof typicalPrice === "number" && typicalPrice < startingPrice) rowErrors.push("Typical price cannot be lower than starting price.");
    if (startingPrice == null && typicalPrice == null && (pricingUnit !== "quote" || !pricingSummary || pricingSummary.length < 10)) rowErrors.push("Add confirmed pricing or an explicit quote-required pricing summary.");
    if (pricingSummary && (pricingSummary.length < 10 || pricingSummary.length > 1000)) rowErrors.push("Pricing summary must be between 10 and 1,000 characters.");
    if (pricingUnitInput && !pricingUnits.has(pricingUnitInput)) rowErrors.push("Pricing unit must be package, hour, person, item, event or quote.");
    if (value(raw, "Hero image URL") && !heroImage) rowErrors.push("Hero image URL must be http or https.");
    if (value(raw, "Image permission evidence URL") && !imageEvidence) rowErrors.push("Image permission evidence URL must be http or https.");
    if (imageCredit && imageCredit.length > 240) rowErrors.push("Image credit must be under 240 characters.");
    if (reviewNotes && reviewNotes.length > 2000) rowErrors.push("Review notes must be under 2,000 characters.");
    if (imageStatus === "approved" && (!imageEvidence || !imageCredit)) rowErrors.push("Approved imagery requires a permission evidence URL and image credit.");
    if (sourceType === "official_website" && (!officialWebsite || !sourceUrl || hostname(officialWebsite) !== hostname(sourceUrl))) rowErrors.push("An official_website source must use the supplier's official website host.");

    const staleDate = new Date(`${researchedAt}T00:00:00Z`);
    const todayDate = new Date(`${today}T00:00:00Z`);
    if (isDate(researchedAt) && (todayDate.getTime() - staleDate.getTime()) / 86_400_000 > 365) warnings.push({ row: rowNumber, business, message: "Research is more than one year old and should be refreshed before acceptance." });
    if (heroImage && imageStatus !== "approved") warnings.push({ row: rowNumber, business, message: "Image is retained for permission review but will not be copied to a listing." });
    if (reviewNotes) warnings.push({ row: rowNumber, business, message: "Manual review notes must be resolved and recorded before acceptance." });

    if (rowErrors.length) {
      errors.push(...rowErrors.map((message) => ({ row: rowNumber, business, message })));
      continue;
    }
    seenSlugs.add(slug);
    candidates.push({
      row_number: rowNumber,
      identity_key: `${categorySlug}:${slug}`,
      category_slug: categorySlug,
      slug,
      business_name: business,
      base_town: baseTown,
      region,
      country: value(raw, "Country") || "Scotland",
      service_areas: serviceAreas,
      travels_nationwide: yes(value(raw, "Travels nationwide")),
      summary,
      description,
      services,
      official_website_url: officialWebsite,
      instagram_url: instagramUrl,
      facebook_url: facebookUrl,
      enquiry_url: enquiryUrl,
      starting_price_pence: startingPrice === false ? null : startingPrice,
      typical_price_pence: typicalPrice === false ? null : typicalPrice,
      pricing_summary: pricingSummary,
      pricing_unit: pricingUnit,
      hero_image_url: heroImage,
      image_credit: imageCredit,
      image_permission_status: imageStatus,
      image_permission_evidence_url: imageEvidence,
      source_url: sourceUrl!,
      source_type: sourceType,
      researched_at: researchedAt,
      review_notes: reviewNotes
    });
  }
  return { candidates, errors, warnings };
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  row.push(cell); rows.push(row);
  return rows.filter((items) => items.some((item) => item.trim()));
}

function normalizeHeader(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function value(row: RawRow, header: string) { return row[normalizeHeader(header)]?.trim() ?? ""; }
function slugify(input: string) { return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 160); }
function list(input: string) { return Array.from(new Set(input.split(/[\n;|]+/).map((item) => item.trim()).filter(Boolean))); }
function yes(input: string) { return ["yes", "true", "y", "1"].includes(input.toLowerCase()); }
function isDate(input: string) { const parsed = new Date(`${input}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(input) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === input; }
function hostname(input: string) { return new URL(input).hostname.replace(/^www\./, "").toLowerCase(); }
function httpUrl(input: string, optional = false): string | null {
  if (!input) return optional ? null : null;
  if (input.length > 1000) return null;
  try { const url = new URL(input); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : null; } catch { return null; }
}
function poundsToPence(input: string): number | null | false {
  const clean = input.trim().replace(/^£/, "").replace(/,/g, "");
  if (!clean) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return false;
  const pence = Math.round(Number(clean) * 100);
  return Number.isSafeInteger(pence) && pence >= 0 && pence <= 2_147_483_647 ? pence : false;
}
