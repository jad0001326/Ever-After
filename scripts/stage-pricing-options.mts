import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  createPricingSourceFingerprint,
  type PricingRecoveryOption,
  type PricingRecoverySummary
} from "../src/lib/enrichment/pricing-recovery.ts";

type PricingOptionsDocument = {
  summary: PricingRecoverySummary;
  options: PricingRecoveryOption[];
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
if (!args.confirmed) {
  throw new Error("Add --confirm-stage-pricing to create private pricing drafts. This never publishes prices, changes venues, or sends email.");
}

await loadEnv(path.join(root, ".env.local"));
await loadEnv(path.join(root, ".env"));
const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const sourcePath = path.resolve(root, args.from);
const document = JSON.parse(await readFile(sourcePath, "utf8")) as unknown;
const validated = validateDocument(document);

let inserted = 0;
for (let index = 0; index < validated.options.length; index += 100) {
  const rows = validated.options.slice(index, index + 100).map(toDraftRow);
  inserted += await insertDrafts(rows);
}

process.stdout.write(`${JSON.stringify({
  staged: inserted > 0,
  idempotentReplay: inserted === 0,
  sourcePath,
  requestedDrafts: validated.options.length,
  insertedDrafts: inserted,
  existingDraftsSkipped: validated.options.length - inserted,
  publishedPrices: 0,
  venueChanges: 0,
  businessDataChanges: 0,
  emailsSent: 0
}, null, 2)}\n`);

function parseArgs(values: string[]) {
  const args = new Map<string, string | true>();
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const separator = value.indexOf("=");
    if (separator < 0) args.set(value.slice(2), true);
    else args.set(value.slice(2, separator), value.slice(separator + 1));
  }
  const from = args.get("from");
  if (typeof from !== "string" || !from) throw new Error("--from=<path-to-pricing-options.json> is required.");
  return { from, confirmed: args.get("confirm-stage-pricing") === true };
}

function validateDocument(value: unknown): PricingOptionsDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The pricing options file is not a JSON object.");
  const document = value as Partial<PricingOptionsDocument>;
  if (!document.summary || document.summary.sourceMode !== "dry_run" || document.summary.sourceDatabaseWrites !== 0 || document.summary.sourceEmailsSent !== 0) {
    throw new Error("The pricing options must originate from a verified zero-write, zero-email dry-run audit.");
  }
  if (document.summary.databaseWrites !== 0 || document.summary.venueChanges !== 0 || document.summary.emailsSent !== 0) {
    throw new Error("The pricing recovery summary does not preserve the zero-write safety boundary.");
  }
  if (!Array.isArray(document.options)) throw new Error("The pricing options file has no options array.");
  if (document.summary.draftOptions !== document.options.length) throw new Error("The pricing options count does not match its recovery summary.");
  if (document.summary.autoPublishEligible + document.summary.manualReview !== document.options.length) {
    throw new Error("The pricing review classifications do not match the options count.");
  }
  const fingerprints = new Set<string>();
  for (const [index, option] of document.options.entries()) {
    validateOption(option, index);
    if (fingerprints.has(option.sourceFingerprint)) throw new Error(`Duplicate source fingerprint at option ${index}.`);
    fingerprints.add(option.sourceFingerprint);
  }
  return document as PricingOptionsDocument;
}

function validateOption(option: PricingRecoveryOption, index: number) {
  const kinds = new Set(["venue_hire", "exclusive_use", "wedding_package", "per_person", "ceremony_fee", "catering", "accommodation", "minimum_spend", "quote_required", "other"]);
  const units = new Set(["total", "per_person", "per_night", "per_room", "per_event", "per_hour", "unspecified", "quote"]);
  const sourceTypes = new Set(["official_website", "official_brochure"]);
  if (!option || typeof option !== "object") throw new Error(`Option ${index} is not an object.`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(option.venueId)) throw new Error(`Option ${index} has an invalid venue ID.`);
  if (!kinds.has(option.kind)) throw new Error(`Option ${index} has an unsupported price kind.`);
  if (!units.has(option.pricingUnit)) throw new Error(`Option ${index} has an unsupported pricing unit.`);
  if (!sourceTypes.has(option.sourceType)) throw new Error(`Option ${index} has an unsupported source type.`);
  if (typeof option.autoPublishEligible !== "boolean" || typeof option.requiresManualReview !== "boolean" || option.autoPublishEligible === option.requiresManualReview) {
    throw new Error(`Option ${index} has inconsistent review classification.`);
  }
  if (!Array.isArray(option.reviewReasons) || (option.requiresManualReview && option.reviewReasons.length === 0) || (option.autoPublishEligible && option.reviewReasons.length > 0)) {
    throw new Error(`Option ${index} has inconsistent review reasons.`);
  }
  if (option.status !== "draft") throw new Error(`Option ${index} is not a draft; this command cannot publish pricing.`);
  if (option.currency !== "GBP") throw new Error(`Option ${index} is not denominated in GBP.`);
  if (!["from", "fixed", "range_low", "range_high", "quote"].includes(option.qualifier)) throw new Error(`Option ${index} has an invalid price qualifier.`);
  if (!option.label?.trim() || option.label.trim().length > 160) throw new Error(`Option ${index} has an invalid label.`);
  const fingerprintVersion = option.fingerprintVersion ?? 1;
  if (fingerprintVersion !== 1 && fingerprintVersion !== 2) throw new Error(`Option ${index} has an unsupported fingerprint version.`);
  if (!option.sourceTitle?.trim() || option.sourceTitle.trim().length > 300) throw new Error(`Option ${index} has an invalid source title.`);
  if (!option.evidenceText?.trim() || option.evidenceText.length > 300) throw new Error(`Option ${index} must contain a short evidence excerpt of at most 300 characters.`);
  if (option.includedGuests !== null && (!Number.isInteger(option.includedGuests) || option.includedGuests <= 0)) throw new Error(`Option ${index} has invalid included guests.`);
  if (option.seasonLabel !== null && (!option.seasonLabel.trim() || option.seasonLabel.length > 120)) throw new Error(`Option ${index} has an invalid season label.`);
  if (option.dayLabel !== null && (!option.dayLabel.trim() || option.dayLabel.length > 120)) throw new Error(`Option ${index} has an invalid day label.`);
  if (option.description != null && (typeof option.description !== "string" || option.description.length > 4_000)) throw new Error(`Option ${index} has an invalid description.`);
  if (option.taxLabel != null && (typeof option.taxLabel !== "string" || !option.taxLabel.trim() || option.taxLabel.length > 80)) throw new Error(`Option ${index} has an invalid tax label.`);
  if (option.minimumNights != null && (!Number.isInteger(option.minimumNights) || option.minimumNights < 1 || option.minimumNights > 365)) throw new Error(`Option ${index} has invalid minimum nights.`);
  if (option.validFrom != null && !/^\d{4}-\d{2}-\d{2}$/.test(option.validFrom)) throw new Error(`Option ${index} has an invalid valid-from date.`);
  if (option.validTo != null && !/^\d{4}-\d{2}-\d{2}$/.test(option.validTo)) throw new Error(`Option ${index} has an invalid valid-to date.`);
  if (option.validFrom && option.validTo && option.validTo < option.validFrom) throw new Error(`Option ${index} has an inverted validity window.`);
  if (option.displayPriority != null && (!Number.isInteger(option.displayPriority) || option.displayPriority < 0 || option.displayPriority > 10_000)) throw new Error(`Option ${index} has an invalid display priority.`);
  if (!validHttpUrl(option.sourceUrl)) throw new Error(`Option ${index} has an invalid source URL.`);
  if (option.lastCheckedAt !== null && !Number.isFinite(Date.parse(option.lastCheckedAt))) throw new Error(`Option ${index} has an invalid source check date.`);
  if (!/^[0-9a-f]{64}$/.test(option.sourceFingerprint)) throw new Error(`Option ${index} has an invalid source fingerprint.`);
  if (option.kind === "quote_required") {
    if (option.pricingUnit !== "quote" || option.qualifier !== "quote" || option.amountFromPence !== null || option.amountToPence !== null) {
      throw new Error(`Option ${index} has an invalid quote-required amount.`);
    }
  } else {
    if (option.pricingUnit === "quote" || option.qualifier === "quote" || !Number.isSafeInteger(option.amountFromPence) || (option.amountFromPence ?? 0) <= 0) {
      throw new Error(`Option ${index} has an invalid numeric amount.`);
    }
    if (option.amountToPence !== null && (!Number.isSafeInteger(option.amountToPence) || option.amountToPence < option.amountFromPence!)) {
      throw new Error(`Option ${index} has an invalid upper amount.`);
    }
  }
  const recalculated = createPricingSourceFingerprint({ ...option, fingerprintVersion });
  if (recalculated !== option.sourceFingerprint) throw new Error(`Option ${index} source fingerprint does not match its source-backed values.`);
}

function toDraftRow(option: PricingRecoveryOption) {
  return {
    venue_id: option.venueId,
    kind: option.kind,
    label: option.label,
    amount_from_pence: option.amountFromPence,
    amount_to_pence: option.amountToPence,
    currency: "GBP",
    pricing_unit: option.pricingUnit,
    price_qualifier: databasePriceQualifier(option),
    included_guests: option.includedGuests,
    season_label: option.seasonLabel,
    day_label: option.dayLabel,
    description: option.description ?? null,
    tax_label: option.taxLabel ?? null,
    minimum_nights: option.minimumNights ?? null,
    source_type: option.sourceType,
    source_url: option.sourceUrl,
    source_title: option.sourceTitle,
    evidence_text: option.evidenceText,
    source_fingerprint: option.sourceFingerprint,
    valid_from: option.validFrom ?? null,
    valid_to: option.validTo ?? null,
    last_checked_at: option.lastCheckedAt,
    verification_method: null,
    verified_at: null,
    verified_by: null,
    status: "draft",
    published_at: null,
    superseded_at: null,
    superseded_by: null,
    display_priority: option.displayPriority ?? 100,
    created_by: null,
    updated_by: null
  };
}

function databasePriceQualifier(option: PricingRecoveryOption) {
  if (option.kind === "quote_required" || option.pricingUnit === "quote") return "quote" as const;
  if (option.amountToPence != null && option.amountToPence > (option.amountFromPence ?? 0)) return "range" as const;
  if (option.qualifier === "fixed") return "fixed" as const;
  return "from" as const;
}

async function insertDrafts(rows: Array<ReturnType<typeof toDraftRow>>) {
  if (rows.length === 0) return 0;
  const url = new URL(`${supabaseUrl}/rest/v1/venue_price_options`);
  url.searchParams.set("on_conflict", "source_fingerprint");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation"
    },
    body: JSON.stringify(rows)
  });
  if (!response.ok) {
    const details = await response.text();
    const migrationHint = response.status === 404 || /venue_price_options|schema cache/i.test(details)
      ? " Run supabase/phase11_pricing_recovery.sql and ensure service_role has INSERT and SELECT privileges."
      : "";
    throw new Error(`Pricing draft staging failed (${response.status}): ${details}.${migrationHint}`);
  }
  const inserted = await response.json() as unknown;
  if (!Array.isArray(inserted)) throw new Error("Pricing draft staging returned an unexpected response.");
  return inserted.length;
}

function validHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

async function loadEnv(filePath: string) {
  try {
    const text = await readFile(filePath, "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const separator = line.indexOf("=");
      const name = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      process.env[name] ??= value;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to stage private pricing drafts.`);
  return value;
}
