import { createHash } from "node:crypto";
import {
  normalizePublishedPriceEvidence,
  type PublishedPrice,
  type PublishedPriceBasis,
  type ResearchConfidence
} from "./research.ts";

export const PRICING_RECOVERY_VERSION = 2;

export type VenuePriceKind =
  | "venue_hire"
  | "exclusive_use"
  | "wedding_package"
  | "per_person"
  | "ceremony_fee"
  | "catering"
  | "accommodation"
  | "minimum_spend"
  | "quote_required"
  | "other";

export type VenuePriceUnit = PublishedPrice["unit"] | "quote";
export type VenuePriceSourceType = "official_website" | "official_brochure";

export type PricingRecoveryOption = {
  fingerprintVersion: 1 | 2;
  venueId: string;
  venueName: string;
  venueSlug: string | null;
  kind: VenuePriceKind;
  label: string;
  amountFromPence: number | null;
  amountToPence: number | null;
  currency: "GBP";
  pricingUnit: VenuePriceUnit;
  includedGuests: number | null;
  seasonLabel: string | null;
  dayLabel: string | null;
  description: string | null;
  taxLabel: string | null;
  minimumNights: number | null;
  validFrom: string | null;
  validTo: string | null;
  displayPriority: number;
  sourceType: VenuePriceSourceType;
  sourceUrl: string;
  sourceTitle: string;
  evidenceText: string;
  lastCheckedAt: string | null;
  confidence: ResearchConfidence;
  qualifier: PublishedPrice["qualifier"] | "quote";
  extractionMethod: PublishedPrice["extractionMethod"] | "official_contact_instruction" | "manual_verification";
  autoPublishEligible: boolean;
  requiresManualReview: boolean;
  reviewReasons: string[];
  status: "draft";
  sourceFingerprint: string;
};

export type RejectedPriceFinding = {
  venueId: string;
  venueName: string;
  sourceUrl: string | null;
  amount: number | null;
  currency: string | null;
  context: string;
  reason: "invalid_finding" | "missing_source" | "unsafe_or_unrelated_price" | "duplicate_finding";
  details: string;
  sourceFingerprint: string | null;
};

export type PricingRecoverySummary = {
  recoveryVersion: number;
  generatedAt: string | null;
  sourceMode: string | null;
  sourceDatabaseWrites: number | null;
  sourceEmailsSent: number | null;
  researchResultsRead: number;
  venuesWithDraftOptions: number;
  draftOptions: number;
  autoPublishEligible: number;
  manualReview: number;
  numericOptions: number;
  quoteRequiredOptions: number;
  explicitRangesCombined: number;
  rejectedFindings: number;
  duplicateFindingsRemoved: number;
  byKind: Record<string, number>;
  byUnit: Record<string, number>;
  databaseWrites: 0;
  venueChanges: 0;
  emailsSent: 0;
};

export type PricingRecoveryReport = {
  summary: PricingRecoverySummary;
  options: PricingRecoveryOption[];
  rejectedFindings: RejectedPriceFinding[];
};

type JsonObject = Record<string, unknown>;

type Candidate = PricingRecoveryOption & {
  provenanceKey: string;
};

const priceBases = new Set<PublishedPriceBasis>([
  "venue_hire",
  "exclusive_use",
  "wedding_package",
  "per_person",
  "catering",
  "accommodation",
  "ceremony_fee",
  "minimum_spend",
  "wedding_price"
]);
const priceUnits = new Set<PublishedPrice["unit"]>(["total", "per_person", "per_night", "per_room", "per_event"]);
const priceQualifiers = new Set<PublishedPrice["qualifier"]>(["from", "fixed", "range_low", "range_high"]);
const confidenceValues = new Set<ResearchConfidence>(["high", "medium", "low"]);
const extractionMethods = new Set<PublishedPrice["extractionMethod"]>(["visible_text", "json_ld_offer", "legacy_checkpoint"]);

export function buildPricingRecovery(input: unknown): PricingRecoveryReport {
  const root = asObject(input);
  const sourceSummary = asObject(root?.summary);
  const sourceMode = asString(sourceSummary?.mode);
  const sourceDatabaseWrites = asFiniteNumber(sourceSummary?.databaseWrites);
  const sourceEmailsSent = asFiniteNumber(sourceSummary?.emailsSent);
  if (sourceMode !== "dry_run" || sourceDatabaseWrites !== 0 || sourceEmailsSent !== 0) {
    throw new Error("Pricing recovery requires a verified dry-run audit with zero database writes and zero emails sent.");
  }

  const generatedAt = validIsoString(sourceSummary?.generatedAt);
  const records = asArray(root?.records);
  const recordById = new Map<string, JsonObject>();
  for (const recordValue of records) {
    const record = asObject(recordValue);
    const id = asString(record?.entityId);
    if (record && id) recordById.set(id, record);
  }

  const researchResults = asArray(root?.researchResults)
    .map(asObject)
    .filter((value): value is JsonObject => value !== null)
    .sort((left, right) => stableText(left.targetId).localeCompare(stableText(right.targetId)));
  const candidates: Candidate[] = [];
  const rejected: RejectedPriceFinding[] = [];

  for (let researchIndex = 0; researchIndex < researchResults.length; researchIndex += 1) {
    const research = researchResults[researchIndex];
    const venueId = asString(research.targetId);
    if (!venueId) continue;
    const record = recordById.get(venueId);
    const venueName = asString(research.businessName) ?? asString(record?.businessName) ?? venueId;
    const venueSlug = asString(record?.slug);
    const officialWebsiteUrl = normalizedHttpUrl(asString(research.officialWebsiteUrl));
    const lastCheckedAt = validIsoString(research.checkedAt);
    const prices = asArray(research.publishedPrices);

    for (let priceIndex = 0; priceIndex < prices.length; priceIndex += 1) {
      const raw = asObject(prices[priceIndex]);
      const amount = asFiniteNumber(raw?.amount);
      const currency = asString(raw?.currency);
      const context = compactText(asString(raw?.context) ?? asString(raw?.evidenceText) ?? "", 800);
      const rawSourceUrl = asString(raw?.sourceUrl);
      const sourceUrl = normalizedHttpUrl(rawSourceUrl);
      const rejectionBase = { venueId, venueName, sourceUrl, amount, currency, context: evidenceExcerpt(context, amount) };
      if (amount === null || !context) {
        rejected.push({
          ...rejectionBase,
          reason: "invalid_finding",
          details: "The finding has no finite amount or usable evidence context.",
          sourceFingerprint: null
        });
        continue;
      }
      if (!sourceUrl) {
        rejected.push({
          ...rejectionBase,
          reason: "missing_source",
          details: "A source-backed price must retain an exact HTTP(S) source URL.",
          sourceFingerprint: null
        });
        continue;
      }

      const normalized = normalizeLegacyPrice(raw, amount, context, sourceUrl);
      if (!normalized) {
        rejected.push({
          ...rejectionBase,
          sourceUrl,
          reason: "unsafe_or_unrelated_price",
          details: "The price classifier rejected this as unsafe, unrelated, ambiguous, a deposit, or a discount.",
          sourceFingerprint: null
        });
        continue;
      }

      const explicitRange = extractExplicitRange(normalized.context, normalized.amount);
      const kind = kindForBasis(normalized.basis, normalized.unit);
      const includedGuests = extractIncludedGuests(normalized.context, normalized.amount);
      const seasonLabel = extractSeasonLabel(normalized.context, normalized.amount);
      const dayLabel = extractDayLabel(normalized.context, normalized.amount);
      const sourceType = sourceTypeForUrl(sourceUrl);
      const amountFromPence = toPence(explicitRange?.from ?? normalized.amount);
      const amountToPence = explicitRange ? toPence(explicitRange.to) : null;
      const reviewReasons = numericReviewReasons({
        normalized,
        kind,
        sourceUrl,
        officialWebsiteUrl,
        lastCheckedAt,
        generatedAt,
        amountFromPence,
        amountToPence
      });
      const autoPublishEligible = reviewReasons.length === 0;
      const label = optionLabel(kind, normalized.unit);
      const qualifier = explicitRange ? "range_low" as const : normalized.qualifier;
      const sourceFingerprint = createPricingSourceFingerprint({
        fingerprintVersion: PRICING_RECOVERY_VERSION,
        venueId,
        kind,
        label,
        pricingUnit: normalized.unit,
        amountFromPence,
        amountToPence,
        sourceUrl,
        includedGuests,
        seasonLabel,
        dayLabel,
        taxLabel: null,
        minimumNights: null,
        validFrom: null,
        validTo: null,
        qualifier
      });
      candidates.push({
        fingerprintVersion: PRICING_RECOVERY_VERSION,
        venueId,
        venueName,
        venueSlug,
        kind,
        label,
        amountFromPence,
        amountToPence,
        currency: "GBP",
        pricingUnit: normalized.unit,
        includedGuests,
        seasonLabel,
        dayLabel,
        description: null,
        taxLabel: null,
        minimumNights: null,
        validFrom: null,
        validTo: null,
        displayPriority: 100,
        sourceType,
        sourceUrl,
        sourceTitle: compactText(`${venueName} official pricing`, 300),
        evidenceText: evidenceExcerpt(normalized.evidenceText || normalized.context, normalized.amount),
        lastCheckedAt,
        confidence: normalized.confidence,
        qualifier,
        extractionMethod: normalized.extractionMethod,
        autoPublishEligible,
        requiresManualReview: !autoPublishEligible,
        reviewReasons,
        status: "draft",
        sourceFingerprint,
        provenanceKey: `${researchIndex}:${priceIndex}`
      });
    }

    if (research.pricingStatus === "contact_for_price") {
      const contact = contactPriceEvidence(research, officialWebsiteUrl);
      if (contact.sourceUrl) {
        const sourceType = sourceTypeForUrl(contact.sourceUrl);
        const reviewReasons: string[] = [];
        if (!officialWebsiteUrl || !sameOfficialHost(contact.sourceUrl, officialWebsiteUrl)) reviewReasons.push("source_host_not_official");
        if (!lastCheckedAt) reviewReasons.push("missing_source_check_date");
        if (!contact.exactEvidence) reviewReasons.push("contact_instruction_requires_source_review");
        if (isStale(lastCheckedAt, generatedAt)) reviewReasons.push("source_check_is_stale");
        const sourceFingerprint = createPricingSourceFingerprint({
          fingerprintVersion: PRICING_RECOVERY_VERSION,
          venueId,
          kind: "quote_required",
          label: "Contact venue for current pricing",
          pricingUnit: "quote",
          amountFromPence: null,
          amountToPence: null,
          sourceUrl: contact.sourceUrl,
          includedGuests: null,
          seasonLabel: null,
          dayLabel: null,
          taxLabel: null,
          minimumNights: null,
          validFrom: null,
          validTo: null,
          qualifier: "quote"
        });
        const autoPublishEligible = reviewReasons.length === 0;
        candidates.push({
          fingerprintVersion: PRICING_RECOVERY_VERSION,
          venueId,
          venueName,
          venueSlug,
          kind: "quote_required",
          label: "Contact venue for current pricing",
          amountFromPence: null,
          amountToPence: null,
          currency: "GBP",
          pricingUnit: "quote",
          includedGuests: null,
          seasonLabel: null,
          dayLabel: null,
          description: null,
          taxLabel: null,
          minimumNights: null,
          validFrom: null,
          validTo: null,
          displayPriority: 100,
          sourceType,
          sourceUrl: contact.sourceUrl,
          sourceTitle: compactText(`${venueName} official pricing`, 300),
          evidenceText: compactText(contact.evidenceText, 300),
          lastCheckedAt,
          confidence: contact.exactEvidence ? "high" : "medium",
          qualifier: "quote",
          extractionMethod: "official_contact_instruction",
          autoPublishEligible,
          requiresManualReview: !autoPublishEligible,
          reviewReasons,
          status: "draft",
          sourceFingerprint,
          provenanceKey: `${researchIndex}:contact`
        });
      }
    }
  }

  const groupedCandidates = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const group = groupedCandidates.get(candidate.sourceFingerprint) ?? [];
    group.push(candidate);
    groupedCandidates.set(candidate.sourceFingerprint, group);
  }
  const options: PricingRecoveryOption[] = [];
  let duplicateFindingsRemoved = 0;
  for (const [sourceFingerprint, group] of [...groupedCandidates.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    group.sort(compareCandidatePreference);
    const [winner, ...duplicates] = group;
    const { provenanceKey: _provenanceKey, ...option } = winner;
    options.push(option);
    duplicateFindingsRemoved += duplicates.length;
    for (const duplicate of duplicates) {
      rejected.push({
        venueId: duplicate.venueId,
        venueName: duplicate.venueName,
        sourceUrl: duplicate.sourceUrl,
        amount: duplicate.amountFromPence === null ? null : duplicate.amountFromPence / 100,
        currency: duplicate.currency,
        context: duplicate.evidenceText,
        reason: "duplicate_finding",
        details: "An equivalent option from the same official source was retained once.",
        sourceFingerprint
      });
    }
  }

  options.sort(compareOptions);
  rejected.sort(compareRejected);
  const uniqueRangeFingerprints = new Set(options.filter((option) => option.amountToPence !== null).map((option) => option.sourceFingerprint));
  const byKind = countBy(options, (option) => option.kind);
  const byUnit = countBy(options, (option) => option.pricingUnit);
  const summary: PricingRecoverySummary = {
    recoveryVersion: PRICING_RECOVERY_VERSION,
    generatedAt,
    sourceMode,
    sourceDatabaseWrites,
    sourceEmailsSent,
    researchResultsRead: researchResults.length,
    venuesWithDraftOptions: new Set(options.map((option) => option.venueId)).size,
    draftOptions: options.length,
    autoPublishEligible: options.filter((option) => option.autoPublishEligible).length,
    manualReview: options.filter((option) => option.requiresManualReview).length,
    numericOptions: options.filter((option) => option.amountFromPence !== null).length,
    quoteRequiredOptions: options.filter((option) => option.kind === "quote_required").length,
    explicitRangesCombined: uniqueRangeFingerprints.size,
    rejectedFindings: rejected.length,
    duplicateFindingsRemoved,
    byKind,
    byUnit,
    databaseWrites: 0,
    venueChanges: 0,
    emailsSent: 0
  };
  return { summary, options, rejectedFindings: rejected };
}

export function createPricingSourceFingerprint(option: Pick<
  PricingRecoveryOption,
  "venueId" | "kind" | "pricingUnit" | "amountFromPence" | "amountToPence" | "sourceUrl" | "includedGuests" | "seasonLabel" | "dayLabel"
> & Partial<Pick<
  PricingRecoveryOption,
  "fingerprintVersion" | "label" | "taxLabel" | "minimumNights" | "validFrom" | "validTo" | "qualifier"
>>) {
  const version = option.fingerprintVersion === 2 ? 2 : 1;
  const identity = {
    version,
    venueId: option.venueId,
    kind: option.kind,
    pricingUnit: option.pricingUnit,
    amountFromPence: option.amountFromPence,
    amountToPence: option.amountToPence,
    sourceUrl: canonicalUrlKey(option.sourceUrl),
    includedGuests: option.includedGuests,
    seasonLabel: normalizedLabel(option.seasonLabel),
    dayLabel: normalizedLabel(option.dayLabel),
    ...(version === 2 ? {
      label: normalizedLabel(option.label ?? null),
      taxLabel: normalizedLabel(option.taxLabel ?? null),
      minimumNights: option.minimumNights ?? null,
      validFrom: normalizedLabel(option.validFrom ?? null),
      validTo: normalizedLabel(option.validTo ?? null),
      qualifier: normalizedLabel(option.qualifier ?? null)
    } : {})
  };
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export function pricingOptionsToCsv(options: PricingRecoveryOption[]) {
  const headings: Array<keyof PricingRecoveryOption> = [
    "fingerprintVersion", "venueId", "venueName", "venueSlug", "kind", "label", "amountFromPence", "amountToPence", "currency",
    "pricingUnit", "includedGuests", "seasonLabel", "dayLabel", "sourceType", "sourceUrl", "sourceTitle",
    "description", "taxLabel", "minimumNights", "validFrom", "validTo", "displayPriority",
    "evidenceText", "lastCheckedAt", "confidence", "qualifier", "extractionMethod", "autoPublishEligible",
    "requiresManualReview", "reviewReasons", "status", "sourceFingerprint"
  ];
  return toCsv(headings, options);
}

export function rejectedFindingsToCsv(findings: RejectedPriceFinding[]) {
  const headings: Array<keyof RejectedPriceFinding> = [
    "venueId", "venueName", "sourceUrl", "amount", "currency", "context", "reason", "details", "sourceFingerprint"
  ];
  return toCsv(headings, findings);
}

function normalizeLegacyPrice(raw: JsonObject | null, amount: number, context: string, sourceUrl: string) {
  try {
    return normalizePublishedPriceEvidence({
      amount,
      currency: asString(raw?.currency) ?? undefined,
      context,
      sourceUrl,
      basis: enumValue(raw?.basis, priceBases),
      unit: enumValue(raw?.unit, priceUnits),
      qualifier: enumValue(raw?.qualifier, priceQualifiers),
      confidence: enumValue(raw?.confidence, confidenceValues),
      evidenceText: asString(raw?.evidenceText) ?? undefined,
      extractionMethod: enumValue(raw?.extractionMethod, extractionMethods)
    });
  } catch {
    return null;
  }
}

function numericReviewReasons(input: {
  normalized: PublishedPrice;
  kind: VenuePriceKind;
  sourceUrl: string;
  officialWebsiteUrl: string | null;
  lastCheckedAt: string | null;
  generatedAt: string | null;
  amountFromPence: number;
  amountToPence: number | null;
}) {
  const reasons: string[] = [];
  if (input.normalized.confidence !== "high") reasons.push(`${input.normalized.confidence}_confidence_classification`);
  if (input.kind === "other") reasons.push("generic_wedding_price_basis");
  if (!basisAttachedToExactAmount(input.normalized, input.kind)) reasons.push("price_basis_not_attached_to_exact_amount");
  if (!unitAttachedToExactAmount(input.normalized)) reasons.push("pricing_unit_not_attached_to_exact_amount");
  if (hasConflictingNearbyCharge(input.normalized, input.kind)) reasons.push("nearby_component_charge_may_be_misattributed");
  if (hasUnstructuredTaxOrSurcharge(input.normalized)) reasons.push("tax_or_surcharge_requires_review");
  if (!input.officialWebsiteUrl || !sameOfficialHost(input.sourceUrl, input.officialWebsiteUrl)) reasons.push("source_host_not_official");
  if (!input.lastCheckedAt) reasons.push("missing_source_check_date");
  if (isStale(input.lastCheckedAt, input.generatedAt)) reasons.push("source_check_is_stale");
  if (!evidenceContainsCurrencyAmount(input.normalized.evidenceText, input.amountFromPence / 100)) reasons.push("evidence_does_not_show_exact_gbp_amount");
  if (input.amountToPence !== null && !evidenceContainsCurrencyAmount(input.normalized.evidenceText, input.amountToPence / 100)) {
    reasons.push("evidence_does_not_show_exact_gbp_range");
  }
  return [...new Set(reasons)].sort();
}

function contactPriceEvidence(research: JsonObject, officialWebsiteUrl: string | null) {
  const evidence = asArray(research.evidence)
    .map(asObject)
    .filter((value): value is JsonObject => value !== null)
    .filter((item) => asString(item.sourceType) === "official_pricing")
    .map((item) => ({
      sourceUrl: normalizedHttpUrl(asString(item.sourceUrl)),
      notes: compactText(asString(item.notes) ?? "", 300)
    }))
    .filter((item) => item.sourceUrl !== null)
    .sort((left, right) => `${left.sourceUrl}:${left.notes}`.localeCompare(`${right.sourceUrl}:${right.notes}`));
  const exact = evidence.find((item) => /contact|enquir|quote|brochure|price\s+on\s+(?:application|request)/i.test(item.notes));
  if (exact?.sourceUrl) return { sourceUrl: exact.sourceUrl, evidenceText: exact.notes, exactEvidence: true };
  const fallbackCandidates = [
    asString(research.weddingPageUrl),
    ...asArray(research.pagesChecked).map(asString),
    officialWebsiteUrl
  ];
  const sourceUrl = fallbackCandidates.map(normalizedHttpUrl).find((value): value is string => value !== null) ?? null;
  return {
    sourceUrl,
    evidenceText: "The official website was classified as requiring direct contact for current pricing.",
    exactEvidence: false
  };
}

function extractExplicitRange(context: string, amount: number) {
  const pattern = /(?:Â?\u00a3|GBP\s*)\s*((?:[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d{1,5})(?:\.\d{1,2})?)\s*(?:-|\u2013|\u2014|\bto\b)\s*(?:(?:Â?\u00a3|GBP\s*)\s*)?((?:[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d{1,5})(?:\.\d{1,2})?)/gi;
  for (const match of context.matchAll(pattern)) {
    const from = Number(match[1].replaceAll(",", ""));
    const to = Number(match[2].replaceAll(",", ""));
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 20 || to > 500_000 || to <= from) continue;
    if (Math.abs(amount - from) < 0.001 || Math.abs(amount - to) < 0.001) return { from, to };
  }
  return null;
}

function extractIncludedGuests(context: string, amount: number) {
  const local = contextAroundAmount(context, amount, 180);
  const patterns = [
    /(?:for|includes?|including|based\s+on|up\s+to)\s+(?:up\s+to\s+)?(\d{1,3})\s+day\s+guests?\b/i,
    /(?:for|includes?|including|based\s+on|up\s+to)\s+(?:up\s+to\s+)?(\d{1,3})\s+(?:wedding\s+)?guests?\b/i,
    /\b(\d{1,3})\s+day\s+guests?\b/i
  ];
  for (const pattern of patterns) {
    const match = local.match(pattern);
    const guests = match ? Number(match[1]) : NaN;
    if (Number.isInteger(guests) && guests > 0 && guests <= 500) return guests;
  }
  return null;
}

function extractSeasonLabel(context: string, amount: number) {
  const local = contextAroundAmount(context, amount, 170);
  const season = local.match(/\b(?:spring|summer|autumn|fall|winter)(?:\s*(?:\/|&|and|-)\s*(?:spring|summer|autumn|fall|winter))?\b/i)?.[0];
  if (season) return titleCase(season.replace(/\bfall\b/i, "autumn"));
  const peak = local.match(/\b(?:off[-\s]?peak|low\s+season|high\s+season|peak\s+season)\b/i)?.[0];
  if (peak) return titleCase(peak);
  const monthName = "January|February|March|April|May|June|July|August|September|October|November|December";
  const monthRange = local.match(new RegExp(`\\b(${monthName})\\s*(?:-|\\u2013|\\u2014|to|through|until)\\s*(${monthName})\\b`, "i"));
  if (monthRange) return `${titleCase(monthRange[1])} to ${titleCase(monthRange[2])}`;
  const months = [...local.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/gi)]
    .map((match) => titleCase(match[0]));
  const uniqueMonths = [...new Set(months)];
  return uniqueMonths.length > 0 && uniqueMonths.length <= 4 ? uniqueMonths.join(", ") : null;
}

function extractDayLabel(context: string, amount: number) {
  const local = contextAroundAmount(context, amount, 150);
  const range = local.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(?:to|through|-)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i);
  if (range) return `${titleCase(range[1])} to ${titleCase(range[2])}`;
  const category = local.match(/\b(?:midweek|weekend|weekday)\b/i)?.[0];
  if (category) return titleCase(category);
  const day = local.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i)?.[0];
  return day ? titleCase(day) : null;
}

function kindForBasis(basis: PublishedPriceBasis, unit: PublishedPrice["unit"]): VenuePriceKind {
  if (basis === "wedding_price") return unit === "per_person" ? "per_person" : "other";
  return basis;
}

function optionLabel(kind: VenuePriceKind, unit: VenuePriceUnit) {
  const labels: Record<VenuePriceKind, string> = {
    venue_hire: "Venue hire",
    exclusive_use: "Exclusive use",
    wedding_package: "Wedding package",
    per_person: "Wedding price per person",
    ceremony_fee: "Ceremony fee",
    catering: "Wedding catering",
    accommodation: "Wedding accommodation",
    minimum_spend: "Minimum spend",
    quote_required: "Contact venue for current pricing",
    other: "Wedding price"
  };
  const base = labels[kind];
  if (unit === "per_person" && kind !== "per_person") return `${base} per person`;
  if (unit === "per_night") return `${base} per night`;
  if (unit === "per_room") return `${base} per room`;
  return base;
}

function sourceTypeForUrl(sourceUrl: string): VenuePriceSourceType {
  try {
    return new URL(sourceUrl).pathname.toLowerCase().endsWith(".pdf") ? "official_brochure" : "official_website";
  } catch {
    return "official_website";
  }
}

function evidenceContainsCurrencyAmount(evidence: string, amount: number) {
  const compactDigits = String(Math.round(amount * 100) / 100).replace(".", "\\.");
  const grouped = amount.toLocaleString("en-GB", { maximumFractionDigits: 2 }).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:Â?\\u00a3|GBP\\s*)\\s*(?:${grouped}|${compactDigits})(?!\\d)`, "i");
  return pattern.test(evidence);
}

function basisAttachedToExactAmount(price: PublishedPrice, kind: VenuePriceKind) {
  if (kind === "other") return false;
  const local = contextAroundAmount(price.context, price.amount, 70).toLowerCase();
  const patterns: Partial<Record<VenuePriceKind, RegExp>> = {
    venue_hire: /\b(?:venue|wedding|ceremony|reception|full[-\s]?day|evening|three[-\s]?day)\s+(?:room\s+)?hire\b|\bhire\s+fee\b|\bdry\s+hire\b/,
    exclusive_use: /\bexclusive(?:ly)?[-\s]+use\b|\bexclusive\s+hire\b/,
    wedding_package: /\b(?:wedding|reception)\s+(?:day\s+)?packages?\b|\bpackages?\s+for\s+(?:your\s+)?wedding\b/,
    per_person: /\b(?:wedding|reception)\b.{0,45}\b(?:price|package|rate|cost)\b|\b(?:price|package|rate|cost)\b.{0,45}\b(?:wedding|reception)\b/,
    ceremony_fee: /\b(?:ceremony|civil\s+ceremony)\b.{0,35}\b(?:fee|hire|price|cost)\b/,
    catering: /\b(?:catering|menus?|wedding\s+breakfast|food\s+(?:and|&)\s+drink)\b/,
    accommodation: /\b(?:wedding\s+accommodation|bridal\s+suite|bedrooms?|rooms?|stay|accommodation)\b/,
    minimum_spend: /\bminimum\s+(?:food\s+(?:and|&)\s+drink\s+)?spend\b/
  };
  return patterns[kind]?.test(local) ?? true;
}

function unitAttachedToExactAmount(price: PublishedPrice) {
  if (price.unit === "total") return true;
  if (price.unit === "unspecified") return false;
  const local = contextAroundAmount(price.context, price.amount, 55).toLowerCase();
  const patterns: Partial<Record<PublishedPrice["unit"], RegExp>> = {
    per_person: /\bper\s+(?:person|head|guest)\b|\b(?:pp|p\/p)\b/,
    per_night: /\bper\s+night\b/,
    per_room: /\bper\s+(?:room|bedroom)\b/,
    per_hour: /\bper\s+hour\b|\bhourly\b/,
    per_event: /\bper\s+(?:event|wedding)\b|\bfor\s+(?:up\s+to\s+)?\d{1,3}\s+(?:day\s+)?guests?\b/
  };
  return patterns[price.unit]?.test(local) ?? false;
}

function hasConflictingNearbyCharge(price: PublishedPrice, kind: VenuePriceKind) {
  const local = contextAroundAmount(price.context, price.amount, 65).toLowerCase();
  if (["venue_hire", "exclusive_use", "wedding_package"].includes(kind)) {
    if (/\b(?:small\s+garden|walled\s+garden|log\s+fires?|parking|damage|deposit|holding\s+fee)\b.{0,45}(?:Â?\u00a3|gbp)/i.test(local)) return true;
  }
  if (kind === "catering" && /\b(?:photograph|registrar|ceremony|room\s+hire|venue\s+hire)\b.{0,80}(?:Â?\u00a3|gbp)/i.test(local)) return true;
  return false;
}

function hasUnstructuredTaxOrSurcharge(price: PublishedPrice) {
  const local = contextAroundAmount(price.context, price.amount, 55);
  return /(?:\+|plus|excluding|exclusive\s+of|ex\.?)[-\s]*(?:VAT|tax)\b|\bsubject\s+to\s+(?:VAT|tax|service\s+charge)\b/i.test(local);
}

function isStale(checkedAt: string | null, generatedAt: string | null) {
  if (!checkedAt || !generatedAt) return false;
  const checked = Date.parse(checkedAt);
  const generated = Date.parse(generatedAt);
  return Number.isFinite(checked) && Number.isFinite(generated) && generated - checked > 400 * 24 * 60 * 60 * 1000;
}

function sameOfficialHost(sourceUrl: string, officialWebsiteUrl: string) {
  try {
    const sourceHost = normalizedHost(new URL(sourceUrl).hostname);
    const officialHost = normalizedHost(new URL(officialWebsiteUrl).hostname);
    return sourceHost === officialHost || sourceHost.endsWith(`.${officialHost}`) || officialHost.endsWith(`.${sourceHost}`);
  } catch {
    return false;
  }
}

function normalizedHost(host: string) {
  return host.toLowerCase().replace(/^www\./, "");
}

function normalizedHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function canonicalUrlKey(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = normalizedHost(url.hostname);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}

function contextAroundAmount(context: string, amount: number, radius: number) {
  const candidates = [amount.toLocaleString("en-GB"), String(amount), amount.toFixed(2)];
  let index = -1;
  for (const candidate of candidates) {
    index = context.toLowerCase().indexOf(candidate.toLowerCase());
    if (index >= 0) break;
  }
  if (index < 0) return context.slice(0, radius * 2);
  return context.slice(Math.max(0, index - radius), Math.min(context.length, index + String(amount).length + radius));
}

function compareCandidatePreference(left: Candidate, right: Candidate) {
  const confidenceRank: Record<ResearchConfidence, number> = { high: 3, medium: 2, low: 1 };
  return Number(right.autoPublishEligible) - Number(left.autoPublishEligible)
    || confidenceRank[right.confidence] - confidenceRank[left.confidence]
    || right.evidenceText.length - left.evidenceText.length
    || left.sourceUrl.localeCompare(right.sourceUrl)
    || left.provenanceKey.localeCompare(right.provenanceKey);
}

function compareOptions(left: PricingRecoveryOption, right: PricingRecoveryOption) {
  return left.venueName.localeCompare(right.venueName)
    || left.venueId.localeCompare(right.venueId)
    || left.kind.localeCompare(right.kind)
    || left.pricingUnit.localeCompare(right.pricingUnit)
    || (left.amountFromPence ?? Number.MAX_SAFE_INTEGER) - (right.amountFromPence ?? Number.MAX_SAFE_INTEGER)
    || left.sourceFingerprint.localeCompare(right.sourceFingerprint);
}

function compareRejected(left: RejectedPriceFinding, right: RejectedPriceFinding) {
  return left.venueName.localeCompare(right.venueName)
    || left.venueId.localeCompare(right.venueId)
    || left.reason.localeCompare(right.reason)
    || (left.sourceUrl ?? "").localeCompare(right.sourceUrl ?? "")
    || (left.amount ?? 0) - (right.amount ?? 0)
    || left.context.localeCompare(right.context);
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const result: Record<string, number> = {};
  for (const item of items) result[key(item)] = (result[key(item)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function toCsv<T extends object>(headings: Array<keyof T>, rows: T[]) {
  const lines = [headings.map(String).map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headings.map((heading) => {
      const value = row[heading];
      return csvCell(Array.isArray(value) ? value.join(" | ") : value == null ? "" : String(value));
    }).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function toPence(amount: number) {
  return Math.round(amount * 100);
}

function normalizedLabel(value: string | null) {
  return value?.trim().toLowerCase() ?? null;
}

function compactText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function evidenceExcerpt(value: string, amount: number | null) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= 300) return compact;
  if (amount === null) return compact.slice(0, 300).trim();
  const local = contextAroundAmount(compact, amount, 145);
  return compactText(local, 300);
}

function stableText(value: unknown) {
  return asString(value) ?? "";
}

function validIsoString(value: unknown) {
  const text = asString(value);
  return text && Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : null;
}

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>): T | undefined {
  return typeof value === "string" && allowed.has(value as T) ? value as T : undefined;
}
