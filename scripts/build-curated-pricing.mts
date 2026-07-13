import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  createPricingSourceFingerprint,
  pricingOptionsToCsv,
  PRICING_RECOVERY_VERSION,
  type PricingRecoveryOption,
  type PricingRecoverySummary
} from "../src/lib/enrichment/pricing-recovery.ts";

type JsonObject = Record<string, unknown>;
type CuratedOption = PricingRecoveryOption;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const sourcePath = path.resolve(root, args.from);
const outputDir = path.resolve(root, args.output);
const sourceText = await readFile(sourcePath, "utf8");
const sourceHash = createHash("sha256").update(sourceText).digest("hex");
const artifact = validateArtifact(JSON.parse(sourceText) as unknown);
const numeric = artifact.safeOptions.map((item, index) => mapVerifiedOption(item, index));
const quoteRequired = artifact.quoteRequired.map((item, index) => mapQuoteOption(item, numeric.length + index));
const options = assignDisplayPriorities([...numeric, ...quoteRequired], artifact.generatedAt.slice(0, 10)).sort(compareOptions);
const fingerprints = new Set(options.map((option) => option.sourceFingerprint));
if (fingerprints.size !== options.length) throw new Error("Curated pricing produced duplicate source fingerprints.");

const venueIds = new Set(options.map((option) => option.venueId));
const byKind = countBy(options, (option) => option.kind);
const byUnit = countBy(options, (option) => option.pricingUnit);
const summary: PricingRecoverySummary = {
  recoveryVersion: PRICING_RECOVERY_VERSION,
  generatedAt: artifact.generatedAt,
  sourceMode: "dry_run",
  sourceDatabaseWrites: 0,
  sourceEmailsSent: 0,
  researchResultsRead: artifact.counts.venuesAudited,
  venuesWithDraftOptions: venueIds.size,
  draftOptions: options.length,
  autoPublishEligible: options.length,
  manualReview: 0,
  numericOptions: numeric.length,
  quoteRequiredOptions: quoteRequired.length,
  explicitRangesCombined: numeric.filter((option) => option.amountToPence !== null).length,
  rejectedFindings: artifact.counts.manualOrRejectVenues,
  duplicateFindingsRemoved: 0,
  byKind,
  byUnit,
  databaseWrites: 0,
  venueChanges: 0,
  emailsSent: 0
};

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeJson(path.join(outputDir, "pricing-options.json"), { summary, options }),
  writeFile(path.join(outputDir, "pricing-options.csv"), pricingOptionsToCsv(options), "utf8"),
  writeJson(path.join(outputDir, "publication-manifest.json"), {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourcePath,
    sourceSha256: sourceHash,
    expectedOptions: options.length,
    expectedNumericOptions: numeric.length,
    expectedQuoteRequiredOptions: quoteRequired.length,
    expectedVenues: venueIds.size,
    sourceFingerprints: options.map((option) => option.sourceFingerprint)
  }),
  writeJson(path.join(outputDir, "summary.json"), summary)
]);

process.stdout.write(`${JSON.stringify({
  outputDir,
  sourcePath,
  sourceSha256: sourceHash,
  options: options.length,
  numericOptions: numeric.length,
  quoteRequiredOptions: quoteRequired.length,
  venues: venueIds.size,
  databaseWrites: 0,
  venueChanges: 0,
  emailsSent: 0
}, null, 2)}\n`);

function mapVerifiedOption(value: JsonObject, index: number): CuratedOption {
  const base = mapCommon(value, index);
  const kind = requiredEnum(value.kind, ["venue_hire", "exclusive_use", "wedding_package", "per_person", "ceremony_fee", "catering", "accommodation", "minimum_spend", "other"] as const, `safe option ${index} kind`);
  const pricingUnit = requiredEnum(value.unit, ["total", "per_person", "per_night", "per_room", "per_event", "per_hour", "unspecified"] as const, `safe option ${index} unit`);
  const amountFromPence = requiredPositiveInteger(value.amountFromPence, `safe option ${index} amountFromPence`);
  const amountToPence = optionalPositiveInteger(value.amountToPence, `safe option ${index} amountToPence`);
  if (amountToPence !== null && amountToPence < amountFromPence) throw new Error(`Safe option ${index} has an inverted range.`);
  const seasonLabel = optionalShortText(value.season, 120, `safe option ${index} season`);
  const dayLabel = optionalShortText(value.day, 120, `safe option ${index} day`);
  const includedGuests = optionalPositiveInteger(value.includedGuests, `safe option ${index} includedGuests`);
  const taxLabel = optionalShortText(value.tax, 80, `safe option ${index} tax`);
  const minimumNights = optionalPositiveInteger(value.minimumNights, `safe option ${index} minimumNights`);
  const validFrom = optionalDate(value.validFrom, `safe option ${index} validFrom`);
  const validTo = optionalDate(value.validTo, `safe option ${index} validTo`);
  if (validFrom && validTo && validTo < validFrom) throw new Error(`Safe option ${index} has an inverted validity window.`);
  const qualifier = requiredEnum(value.qualifier, ["from", "fixed", "range"] as const, `safe option ${index} qualifier`);
  if (qualifier === "range" && amountToPence === null) throw new Error(`Safe option ${index} is labelled as a range without an upper amount.`);
  if (qualifier !== "range" && amountToPence !== null) throw new Error(`Safe option ${index} has an upper amount without a range qualifier.`);
  const partial = {
    ...base,
    fingerprintVersion: PRICING_RECOVERY_VERSION,
    kind,
    label: requiredShortText(value.title, 160, `safe option ${index} title`),
    amountFromPence,
    amountToPence,
    pricingUnit,
    includedGuests,
    seasonLabel,
    dayLabel,
    description: null,
    taxLabel,
    minimumNights,
    validFrom,
    validTo,
    displayPriority: displayPriority(kind, index),
    qualifier: qualifier === "range" ? "range_low" as const : qualifier,
    extractionMethod: "manual_verification" as const
  };
  return { ...partial, sourceFingerprint: createPricingSourceFingerprint(partial) };
}

function mapQuoteOption(value: JsonObject, index: number): CuratedOption {
  const base = mapCommon(value, index);
  if (value.kind !== "quote_required" || value.unit !== "quote" || value.amountFromPence !== null || value.amountToPence !== null) {
    throw new Error(`Quote option ${index} has an invalid quote-only shape.`);
  }
  const partial = {
    ...base,
    fingerprintVersion: PRICING_RECOVERY_VERSION,
    kind: "quote_required" as const,
    label: "Current wedding pricing",
    amountFromPence: null,
    amountToPence: null,
    pricingUnit: "quote" as const,
    includedGuests: null,
    seasonLabel: null,
    dayLabel: null,
    description: "The venue provides its current wedding price by enquiry.",
    taxLabel: null,
    minimumNights: null,
    validFrom: null,
    validTo: null,
    displayPriority: 900,
    qualifier: "quote" as const,
    extractionMethod: "official_contact_instruction" as const
  };
  return { ...partial, sourceFingerprint: createPricingSourceFingerprint(partial) };
}

function mapCommon(value: JsonObject, index: number) {
  const venueId = requiredUuid(value.venueId, `option ${index} venueId`);
  const venueName = requiredShortText(value.name, 300, `option ${index} name`);
  const venueSlug = requiredShortText(value.slug, 180, `option ${index} slug`);
  const sourceUrl = requiredHttpUrl(value.sourceUrl, `option ${index} sourceUrl`);
  const sourceType = new URL(sourceUrl).pathname.toLowerCase().endsWith(".pdf") ? "official_brochure" as const : "official_website" as const;
  const evidenceText = requiredShortText(value.evidence, 300, `option ${index} evidence`);
  const lastCheckedAt = requiredIsoDateTime(value.checkedAt, `option ${index} checkedAt`);
  const reasons = Array.isArray(value.reasons) ? value.reasons : [];
  if (reasons.length === 0 || reasons.some((reason) => typeof reason !== "string" || !reason.trim())) {
    throw new Error(`Option ${index} has no verification reasons.`);
  }
  return {
    venueId,
    venueName,
    venueSlug,
    currency: "GBP" as const,
    sourceType,
    sourceUrl,
    sourceTitle: `${venueName} official pricing`.slice(0, 300),
    evidenceText,
    lastCheckedAt,
    confidence: "high" as const,
    autoPublishEligible: true,
    requiresManualReview: false,
    reviewReasons: [],
    status: "draft" as const
  };
}

function validateArtifact(value: unknown) {
  const artifact = asObject(value);
  if (!artifact || artifact.schemaVersion !== 1 || artifact.mode !== "read_only_manual_verification") {
    throw new Error("Expected a version-1 read-only manual pricing verification artifact.");
  }
  const counts = asObject(artifact.counts);
  const safeOptions = asObjectArray(artifact.safeOptions, "safeOptions");
  const quoteRequired = asObjectArray(artifact.quoteRequired, "quoteRequired");
  const manualOrReject = asObjectArray(artifact.manualOrReject, "manualOrReject");
  const noPublicPriceFound = asObjectArray(artifact.noPublicPriceFound, "noPublicPriceFound");
  if (!counts || counts.safeOptions !== safeOptions.length || counts.quoteRequiredVenues !== quoteRequired.length || counts.manualOrRejectVenues !== manualOrReject.length || counts.noPublicPriceFoundVenues !== noPublicPriceFound.length) {
    throw new Error("Manual verification section counts do not match the artifact summary.");
  }
  const safeVenues = new Set(safeOptions.map((item) => requiredUuid(item.venueId, "safe venueId")));
  if (safeVenues.size !== counts.safeVenues) throw new Error("Safe venue count does not match the artifact summary.");
  const partitions = [
    safeVenues,
    new Set(quoteRequired.map((item) => requiredUuid(item.venueId, "quote venueId"))),
    new Set(manualOrReject.map((item) => requiredUuid(item.venueId, "manual venueId"))),
    new Set(noPublicPriceFound.map((item) => requiredUuid(item.venueId, "no-price venueId")))
  ];
  const allVenues = new Set<string>();
  for (const partition of partitions) {
    for (const venueId of partition) {
      if (allVenues.has(venueId)) throw new Error(`Venue ${venueId} appears in more than one pricing decision partition.`);
      allVenues.add(venueId);
    }
  }
  if (allVenues.size !== counts.venuesAudited) throw new Error("Pricing decision partitions do not account for every audited venue.");
  if (safeOptions.some((item) => item.decision !== "publish") || quoteRequired.some((item) => item.decision !== "publish_quote_required")) {
    throw new Error("The allowlist contains a non-publication decision.");
  }
  return {
    generatedAt: requiredIsoDateTime(artifact.generatedAt, "generatedAt"),
    counts: counts as {
      venuesAudited: number;
      safeOptions: number;
      safeVenues: number;
      quoteRequiredVenues: number;
      manualOrRejectVenues: number;
      noPublicPriceFoundVenues: number;
    },
    safeOptions,
    quoteRequired
  };
}

function parseArgs(values: string[]) {
  const map = new Map<string, string>();
  for (const value of values) {
    if (!value.startsWith("--") || !value.includes("=")) continue;
    const separator = value.indexOf("=");
    map.set(value.slice(2, separator), value.slice(separator + 1));
  }
  const from = map.get("from");
  const output = map.get("output");
  if (!from) throw new Error("--from=<manual-verification.json> is required.");
  if (!output) throw new Error("--output=<directory> is required.");
  return { from, output };
}

function displayPriority(kind: CuratedOption["kind"], index: number) {
  const priorities: Record<CuratedOption["kind"], number> = {
    venue_hire: 10,
    exclusive_use: 20,
    wedding_package: 30,
    per_person: 40,
    ceremony_fee: 50,
    minimum_spend: 60,
    catering: 70,
    accommodation: 80,
    other: 800,
    quote_required: 900
  };
  return priorities[kind] + Math.min(index, 9);
}

function assignDisplayPriorities(values: CuratedOption[], today: string) {
  const groups = new Map<string, CuratedOption[]>();
  for (const value of values) groups.set(value.venueId, [...(groups.get(value.venueId) ?? []), value]);
  return [...groups.values()].flatMap((group) => group
    .sort((left, right) => comparePrimaryPrice(left, right, today))
    .map((option, index) => ({ ...option, displayPriority: (index + 1) * 10 })));
}

function comparePrimaryPrice(left: CuratedOption, right: CuratedOption, today: string) {
  const kindOrder: CuratedOption["kind"][] = [
    "venue_hire", "exclusive_use", "wedding_package", "per_person", "minimum_spend",
    "ceremony_fee", "catering", "accommodation", "other", "quote_required"
  ];
  const unitOrder: CuratedOption["pricingUnit"][] = [
    "total", "per_event", "per_person", "per_night", "per_room", "per_hour", "unspecified", "quote"
  ];
  return kindOrder.indexOf(left.kind) - kindOrder.indexOf(right.kind)
    || validityRank(left, today) - validityRank(right, today)
    || unresolvedTaxRank(left.taxLabel) - unresolvedTaxRank(right.taxLabel)
    || unitOrder.indexOf(left.pricingUnit) - unitOrder.indexOf(right.pricingUnit)
    || (left.amountFromPence ?? Number.MAX_SAFE_INTEGER) - (right.amountFromPence ?? Number.MAX_SAFE_INTEGER)
    || left.label.localeCompare(right.label)
    || left.sourceFingerprint.localeCompare(right.sourceFingerprint);
}

function validityRank(option: CuratedOption, today: string) {
  if (option.validFrom && option.validFrom > today) return 2;
  if (option.validTo && option.validTo < today) return 3;
  if (option.validFrom || option.validTo) return 0;
  return 1;
}

function unresolvedTaxRank(value: string | null) {
  return value && !/\b(?:included|inclusive|inc\.?|exempt|zero[-\s]?rated|not\s+applicable)\b/i.test(value) ? 1 : 0;
}

function compareOptions(left: CuratedOption, right: CuratedOption) {
  return left.venueName.localeCompare(right.venueName)
    || left.displayPriority - right.displayPriority
    || (left.amountFromPence ?? Number.MAX_SAFE_INTEGER) - (right.amountFromPence ?? Number.MAX_SAFE_INTEGER)
    || left.sourceFingerprint.localeCompare(right.sourceFingerprint);
}

function countBy<T>(values: T[], key: (value: T) => string) {
  const counts: Record<string, number> = {};
  for (const value of values) counts[key(value)] = (counts[key(value)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function asObjectArray(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`${label} is not an array.`);
  return value.map((item, index) => {
    const object = asObject(item);
    if (!object) throw new Error(`${label}[${index}] is not an object.`);
    return object;
  });
}

function requiredShortText(value: unknown, maximum: number, label: string) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new Error(`${label} is invalid.`);
  return value.trim();
}

function optionalShortText(value: unknown, maximum: number, label: string) {
  if (value == null) return null;
  return requiredShortText(value, maximum, label);
}

function requiredUuid(value: unknown, label: string) {
  const text = requiredShortText(value, 64, label);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) throw new Error(`${label} is not a UUID.`);
  return text;
}

function requiredHttpUrl(value: unknown, label: string) {
  const text = requiredShortText(value, 2_000, label);
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("unsafe URL");
    return url.toString();
  } catch {
    throw new Error(`${label} is not a safe HTTP(S) URL.`);
  }
}

function requiredIsoDateTime(value: unknown, label: string) {
  const text = requiredShortText(value, 64, label);
  if (!Number.isFinite(Date.parse(text))) throw new Error(`${label} is not an ISO date-time.`);
  return text;
}

function optionalDate(value: unknown, label: string) {
  if (value == null) return null;
  const text = requiredShortText(value, 10, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(`${text}T00:00:00Z`))) throw new Error(`${label} is not a date.`);
  return text;
}

function requiredPositiveInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(`${label} must be a positive integer.`);
  return Number(value);
}

function optionalPositiveInteger(value: unknown, label: string) {
  if (value == null) return null;
  return requiredPositiveInteger(value, label);
}

function requiredEnum<const T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  if (typeof value !== "string" || !values.includes(value)) throw new Error(`${label} is invalid.`);
  return value as T[number];
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
