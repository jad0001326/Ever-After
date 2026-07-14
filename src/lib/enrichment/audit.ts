import {
  isTrustedVenueContact,
  isValidOutreachEmail,
  normalizeEmail,
  validPublicUrl
} from "../outreach-validation.ts";

export const actualEligibilityBlockers = [
  "claimed",
  "listing_not_published",
  "country_mismatch",
  "invite_not_available",
  "missing_email",
  "invalid_email",
  "unverified_contact",
  "duplicate_email",
  "suppressed",
  "existing_outreach",
  "over_campaign_limit"
] as const;

export const dataQualityIssues = [
  "missing_business_name",
  "missing_category",
  "missing_website",
  "invalid_website",
  "missing_email",
  "invalid_email",
  "unverified_contact",
  "missing_location",
  "missing_short_description",
  "missing_description",
  "missing_price",
  "invalid_price_range",
  "missing_capacity",
  "invalid_capacity",
  "missing_coordinates",
  "partial_coordinates",
  "missing_amenities",
  "representative_image",
  "business_status_unchecked",
  "business_closed",
  "business_status_uncertain",
  "possible_duplicate"
] as const;

export type ActualEligibilityBlocker = (typeof actualEligibilityBlockers)[number];
export type DataQualityIssue = (typeof dataQualityIssues)[number];
export type BusinessStatus = "active" | "likely_active" | "temporarily_closed" | "closed" | "rebranded" | "duplicate" | "uncertain";
export type DuplicateMatchKind = "name_location" | "website_domain" | "email";
export type PricingBasis = "per_person" | "per_day" | "per_event" | "per_room" | "per_package" | "per_hour" | "unspecified";
export type PricingStatus = "published" | "contact_for_price" | "not_found";

export type AuditableVenue = {
  id: string;
  slug?: string | null;
  name: string | null;
  type?: string | null;
  town: string | null;
  region: string | null;
  country: string | null;
  summary?: string | null;
  description?: string | null;
  price_from?: number | null;
  price_to?: number | null;
  pricing_text?: string | null;
  capacity_min?: number | null;
  capacity_max?: number | null;
  official_website_url: string | null;
  vendor_contact_email: string | null;
  vendor_contact_source_url: string | null;
  listing_status: string | null;
  is_claimed: boolean | null;
  invite_status: string | null;
  latitude?: number | null;
  longitude?: number | null;
  amenity_count?: number | null;
  image_is_representative?: boolean | null;
  business_status?: BusinessStatus | null;
};

export type DuplicateMatch = {
  kind: DuplicateMatchKind;
  key: string;
  venueIds: string[];
};

export type PricingParseResult = {
  status: PricingStatus;
  currency: "GBP" | null;
  amounts: number[];
  startingPrice: number | null;
  maximumPublishedPrice: number | null;
  basis: PricingBasis;
};

export type VenueAudit = {
  venueId: string;
  normalizedEmail: string;
  actualEligibilityBlockers: ActualEligibilityBlocker[];
  primaryEligibilityBlocker: ActualEligibilityBlocker | null;
  dataQualityIssues: DataQualityIssue[];
  duplicateMatches: DuplicateMatch[];
  eligibleUnderCurrentRules: boolean;
  recommendedForOutreach: boolean;
  requiresManualReview: boolean;
  pricing: PricingParseResult;
};

export type VenueAuditOptions = {
  country?: string;
  maxRecipients?: number;
  suppressedEmails?: Iterable<string>;
  existingOutreachVenueIds?: Iterable<string>;
};

export type VenueAuditSummary = {
  total: number;
  eligibleUnderCurrentRules: number;
  ineligibleUnderCurrentRules: number;
  recommendedForOutreach: number;
  requiresManualReview: number;
  duplicateGroups: number;
  actualBlockerCounts: Record<ActualEligibilityBlocker, number>;
  dataQualityIssueCounts: Record<DataQualityIssue, number>;
  pricingStatusCounts: Record<PricingStatus, number>;
};

type EligibilityContext = {
  country?: string;
  suppressedEmails?: ReadonlySet<string>;
  existingOutreach?: boolean;
};

const manualReviewIssues = new Set<DataQualityIssue>([
  "business_status_unchecked",
  "business_closed",
  "business_status_uncertain",
  "possible_duplicate"
]);

export function evaluateInitialInviteBlockers(venue: AuditableVenue, context: EligibilityContext = {}) {
  const blockers: ActualEligibilityBlocker[] = [];
  const country = context.country?.trim() || "Scotland";
  const email = normalizeEmail(venue.vendor_contact_email ?? "");

  if (venue.is_claimed !== false) blockers.push("claimed");
  if (venue.listing_status !== "published") blockers.push("listing_not_published");
  if (venue.country !== country) blockers.push("country_mismatch");
  if (venue.invite_status !== "not_sent") blockers.push("invite_not_available");

  if (!email) {
    blockers.push("missing_email");
  } else if (!isValidOutreachEmail(email)) {
    blockers.push("invalid_email");
  } else if (!isTrustedVenueContact(email, venue.vendor_contact_source_url, venue)) {
    blockers.push("unverified_contact");
  } else {
    if (context.suppressedEmails?.has(email)) blockers.push("suppressed");
    if (context.existingOutreach) blockers.push("existing_outreach");
  }

  return blockers;
}

export function auditVenueRecords(venues: readonly AuditableVenue[], options: VenueAuditOptions = {}) {
  const suppressedEmails = new Set(Array.from(options.suppressedEmails ?? [], normalizeEmail));
  const existingOutreachVenueIds = new Set(options.existingOutreachVenueIds ?? []);
  const duplicateMatches = detectVenueDuplicates(venues);
  const matchesByVenue = new Map<string, DuplicateMatch[]>();
  for (const match of duplicateMatches) {
    for (const venueId of match.venueIds) {
      const matches = matchesByVenue.get(venueId) ?? [];
      matches.push(match);
      matchesByVenue.set(venueId, matches);
    }
  }

  const maxRecipients = clampInteger(options.maxRecipients ?? 100, 1, 100);
  let eligibleCount = 0;

  const audits = venues.map((venue): VenueAudit => {
    const email = normalizeEmail(venue.vendor_contact_email ?? "");
    const blockers = evaluateInitialInviteBlockers(venue, {
      country: options.country,
      suppressedEmails,
      existingOutreach: existingOutreachVenueIds.has(venue.id)
    });
    if (blockers.length === 0) {
      if (eligibleCount >= maxRecipients) blockers.push("over_campaign_limit");
      else eligibleCount += 1;
    }

    const matches = matchesByVenue.get(venue.id) ?? [];
    // A central operator may legitimately manage several wedding venues with
    // one published inbox. Only identity signals can make a venue look like a
    // duplicate business; shared-email signals remain audit evidence only.
    const hasBusinessDuplicateSignal = matches.some((match) => match.kind !== "email");
    const qualityIssues = detectDataQualityIssues(venue, hasBusinessDuplicateSignal);
    const requiresManualReview = qualityIssues.some((issue) => manualReviewIssues.has(issue));
    const eligibleUnderCurrentRules = blockers.length === 0;

    return {
      venueId: venue.id,
      normalizedEmail: email,
      actualEligibilityBlockers: blockers,
      primaryEligibilityBlocker: blockers[0] ?? null,
      dataQualityIssues: qualityIssues,
      duplicateMatches: matches,
      eligibleUnderCurrentRules,
      recommendedForOutreach: eligibleUnderCurrentRules && !requiresManualReview,
      requiresManualReview,
      pricing: pricingForVenue(venue)
    };
  });

  return { audits, duplicateMatches, summary: summarizeVenueAudit(audits, duplicateMatches) };
}

export function detectVenueDuplicates(venues: readonly AuditableVenue[]) {
  const definitions: Array<{ kind: DuplicateMatchKind; key: (venue: AuditableVenue) => string }> = [
    { kind: "name_location", key: (venue) => nameLocationKey(venue) },
    { kind: "website_domain", key: (venue) => websiteDomain(venue.official_website_url) },
    { kind: "email", key: (venue) => normalizeEmail(venue.vendor_contact_email ?? "") }
  ];
  const matches: DuplicateMatch[] = [];

  for (const definition of definitions) {
    const groups = new Map<string, string[]>();
    for (const venue of venues) {
      const key = definition.key(venue);
      if (!key) continue;
      const ids = groups.get(key) ?? [];
      ids.push(venue.id);
      groups.set(key, ids);
    }
    for (const [key, venueIds] of groups) {
      if (venueIds.length > 1) matches.push({ kind: definition.kind, key, venueIds });
    }
  }

  return matches;
}

export function summarizeVenueAudit(audits: readonly VenueAudit[], duplicateMatches: readonly DuplicateMatch[] = []): VenueAuditSummary {
  const actualBlockerCounts = countValues(actualEligibilityBlockers);
  const dataQualityIssueCounts = countValues(dataQualityIssues);
  const pricingStatusCounts: Record<PricingStatus, number> = { published: 0, contact_for_price: 0, not_found: 0 };

  for (const audit of audits) {
    for (const blocker of audit.actualEligibilityBlockers) actualBlockerCounts[blocker] += 1;
    for (const issue of audit.dataQualityIssues) dataQualityIssueCounts[issue] += 1;
    pricingStatusCounts[audit.pricing.status] += 1;
  }

  const eligible = audits.filter((audit) => audit.eligibleUnderCurrentRules).length;
  return {
    total: audits.length,
    eligibleUnderCurrentRules: eligible,
    ineligibleUnderCurrentRules: audits.length - eligible,
    recommendedForOutreach: audits.filter((audit) => audit.recommendedForOutreach).length,
    requiresManualReview: audits.filter((audit) => audit.requiresManualReview).length,
    duplicateGroups: duplicateMatches.length,
    actualBlockerCounts,
    dataQualityIssueCounts,
    pricingStatusCounts
  };
}

export function isContactForPriceText(value: string | null | undefined) {
  if (!value) return false;
  return /\b(contact (?:us )?for (?:a )?(?:price|pricing|quote)|(?:prices?|pricing) (?:is |are )?(?:available )?on (?:request|application)|request (?:a )?(?:quote|quotation)|bespoke (?:price|pricing|quote))\b/i.test(value);
}

export function parsePublishedPricing(value: string | null | undefined): PricingParseResult {
  const text = value?.trim() ?? "";
  const amounts = extractPublishedGbpAmounts(text);
  const basis = detectPricingBasis(text);
  if (amounts.length > 0) {
    return {
      status: "published",
      currency: "GBP",
      amounts,
      startingPrice: Math.min(...amounts),
      maximumPublishedPrice: Math.max(...amounts),
      basis
    };
  }
  if (isContactForPriceText(text)) {
    return { status: "contact_for_price", currency: null, amounts: [], startingPrice: null, maximumPublishedPrice: null, basis };
  }
  return { status: "not_found", currency: null, amounts: [], startingPrice: null, maximumPublishedPrice: null, basis };
}

function detectDataQualityIssues(venue: AuditableVenue, isPossibleDuplicate: boolean) {
  const issues: DataQualityIssue[] = [];
  const email = normalizeEmail(venue.vendor_contact_email ?? "");
  const website = venue.official_website_url?.trim() ?? "";

  if (!venue.name?.trim()) issues.push("missing_business_name");
  if (!venue.type?.trim()) issues.push("missing_category");
  if (!website) issues.push("missing_website");
  else if (!validPublicUrl(website)) issues.push("invalid_website");
  if (!email) issues.push("missing_email");
  else if (!isValidOutreachEmail(email)) issues.push("invalid_email");
  else if (!isTrustedVenueContact(email, venue.vendor_contact_source_url, venue)) issues.push("unverified_contact");
  if (!venue.town?.trim() || !venue.region?.trim() || !venue.country?.trim()) issues.push("missing_location");
  if (!venue.summary?.trim()) issues.push("missing_short_description");
  if (!venue.description?.trim()) issues.push("missing_description");
  if (venue.price_from == null && venue.price_to == null && parsePublishedPricing(venue.pricing_text).status === "not_found") issues.push("missing_price");
  if (venue.price_from != null && venue.price_to != null && venue.price_to < venue.price_from) issues.push("invalid_price_range");
  if (venue.capacity_min == null || venue.capacity_max == null) issues.push("missing_capacity");
  else if (venue.capacity_min < 1 || venue.capacity_max < venue.capacity_min) issues.push("invalid_capacity");
  if (venue.latitude == null && venue.longitude == null) issues.push("missing_coordinates");
  else if (venue.latitude == null || venue.longitude == null) issues.push("partial_coordinates");
  if ((venue.amenity_count ?? 0) < 1) issues.push("missing_amenities");
  if (venue.image_is_representative === true) issues.push("representative_image");
  if (!venue.business_status) issues.push("business_status_unchecked");
  else if (venue.business_status === "closed") issues.push("business_closed");
  else if (["temporarily_closed", "rebranded", "duplicate", "uncertain"].includes(venue.business_status)) issues.push("business_status_uncertain");
  if (isPossibleDuplicate || venue.business_status === "duplicate") issues.push("possible_duplicate");
  return issues;
}

function pricingForVenue(venue: AuditableVenue): PricingParseResult {
  const parsed = parsePublishedPricing(venue.pricing_text);
  if (venue.price_from == null && venue.price_to == null) return parsed;
  const amounts = [venue.price_from, venue.price_to].filter((amount): amount is number => amount != null && Number.isFinite(amount) && amount >= 0);
  if (amounts.length === 0) return parsed;
  return {
    status: "published",
    currency: "GBP",
    amounts: Array.from(new Set(amounts)),
    startingPrice: venue.price_from ?? Math.min(...amounts),
    maximumPublishedPrice: venue.price_to ?? venue.price_from ?? Math.max(...amounts),
    basis: parsed.basis
  };
}

function extractPublishedGbpAmounts(value: string) {
  const found: number[] = [];
  const patterns = [/(?:£|GBP\s*)(\d+(?:,\d{3})*(?:\.\d{1,2})?)/gi, /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*GBP\b/gi];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const context = value.slice(Math.max(0, (match.index ?? 0) - 24), (match.index ?? 0) + match[0].length + 8);
      if (/\b(deposit|booking fee|save|discount)\b/i.test(context)) continue;
      const amount = Number(match[1].replaceAll(",", ""));
      if (Number.isFinite(amount) && amount > 0 && amount <= 10_000_000) found.push(amount);
    }
  }
  return Array.from(new Set(found));
}

function detectPricingBasis(value: string): PricingBasis {
  if (/\bper\s+(?:person|head|guest)\b/i.test(value)) return "per_person";
  if (/\bper\s+day\b/i.test(value)) return "per_day";
  if (/\bper\s+(?:event|wedding)\b/i.test(value)) return "per_event";
  if (/\bper\s+room\b/i.test(value)) return "per_room";
  if (/\bper\s+package\b|\bpackage price\b/i.test(value)) return "per_package";
  if (/\bper\s+hour\b|\bhourly\b/i.test(value)) return "per_hour";
  return "unspecified";
}

function nameLocationKey(venue: AuditableVenue) {
  const name = normalizeWords(venue.name);
  const location = [venue.town, venue.region, venue.country].map(normalizeWords).filter(Boolean).join("|");
  return name && location ? `${name}|${location}` : "";
}

function normalizeWords(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:limited|ltd|plc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function websiteDomain(value: string | null | undefined) {
  const url = validPublicUrl(value);
  return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : "";
}

function countValues<const T extends readonly string[]>(values: T) {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T[number], number>;
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export const auditVenues = auditVenueRecords;
export const summarizeVenueAudits = summarizeVenueAudit;
export const parsePricingText = parsePublishedPricing;
