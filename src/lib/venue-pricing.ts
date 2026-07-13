import type { VenuePriceKind, VenuePriceOption, VenuePriceQualifier, VenuePricingUnit } from "@/types/venue";

const KIND_LABELS: Record<VenuePriceKind, string> = {
  venue_hire: "Venue hire",
  exclusive_use: "Exclusive use",
  wedding_package: "Wedding package",
  per_person: "Wedding package",
  ceremony_fee: "Ceremony fee",
  catering: "Catering",
  accommodation: "Accommodation",
  minimum_spend: "Minimum spend",
  quote_required: "Current pricing",
  other: "Pricing"
};

const UNIT_SUFFIXES: Partial<Record<VenuePricingUnit, string>> = {
  per_person: "per person",
  per_night: "per night",
  per_room: "per room",
  per_event: "per event",
  per_hour: "per hour",
  unspecified: "basis not stated"
};

export type VenuePriceDisplay = {
  option: VenuePriceOption | null;
  label: string;
  kindLabel: string;
  amountLabel: string;
  unit: VenuePricingUnit;
  qualifier: VenuePriceQualifier;
  isQuoteRequired: boolean;
  description: string | null;
  detailLabels: string[];
  materialQualifierLabels: string[];
  sourceUrl: string | null;
  verifiedAt: string | null;
};

export function normaliseVenuePriceKind(value: string): VenuePriceKind {
  const kind = normaliseToken(value);
  if (["venue_hire", "hire", "dry_hire"].includes(kind)) return "venue_hire";
  if (["exclusive_use", "exclusive", "exclusive_hire"].includes(kind)) return "exclusive_use";
  if (["wedding_package", "package", "wedding_packages"].includes(kind)) return "wedding_package";
  if (["per_person", "per_head", "price_per_person"].includes(kind)) return "per_person";
  if (["ceremony_fee", "ceremony", "ceremony_hire"].includes(kind)) return "ceremony_fee";
  if (["catering", "food", "food_and_drink"].includes(kind)) return "catering";
  if (["accommodation", "room", "rooms", "overnight"].includes(kind)) return "accommodation";
  if (["minimum_spend", "minimum", "minimum_charge"].includes(kind)) return "minimum_spend";
  if (["quote_required", "quote", "contact_for_price", "contact_for_pricing"].includes(kind)) return "quote_required";
  return "other";
}

export function normaliseVenuePricingUnit(value: string, kind?: string): VenuePricingUnit {
  const unit = normaliseToken(value);
  const normalisedKind = normaliseVenuePriceKind(kind ?? "other");
  if (["per_person", "per_head", "per_guest", "person", "head", "pp"].includes(unit) || normalisedKind === "per_person") return "per_person";
  if (["per_night", "night", "nightly"].includes(unit)) return "per_night";
  if (["per_room", "room"].includes(unit)) return "per_room";
  if (["per_event", "event"].includes(unit)) return "per_event";
  if (["per_hour", "hour", "hourly"].includes(unit)) return "per_hour";
  if (["unspecified", "unknown", "not_stated"].includes(unit)) return "unspecified";
  if (["quote", "quote_required", "contact_for_price"].includes(unit) || normalisedKind === "quote_required") return "quote";
  return "total";
}

export function normaliseVenuePriceQualifier(
  value: string,
  kind?: string,
  amountFromPence?: number | null,
  amountToPence?: number | null
): VenuePriceQualifier {
  if (normaliseVenuePriceKind(kind ?? "other") === "quote_required") return "quote";
  if (amountFromPence != null && amountToPence != null && amountToPence > amountFromPence) return "range";
  const qualifier = normaliseToken(value);
  if (qualifier === "fixed") return "fixed";
  if (qualifier === "range") return "range";
  if (qualifier === "quote") return "quote";
  return "from";
}

export function hasUnresolvedTaxLabel(taxLabel: string | null | undefined) {
  if (!taxLabel?.trim()) return false;
  return !/\b(?:included|inclusive|inc\.?|exempt|zero[-\s]?rated|not\s+applicable)\b/i.test(taxLabel);
}

export function isEligibleVenueSummaryPrice(
  option: Pick<VenuePriceOption, "kind" | "pricingUnit" | "amountFromPence" | "taxLabel" | "validTo">,
  today: string
) {
  return ["venue_hire", "exclusive_use", "wedding_package"].includes(normaliseVenuePriceKind(option.kind))
    && ["total", "per_event"].includes(normaliseVenuePricingUnit(option.pricingUnit, option.kind))
    && option.amountFromPence != null
    && !hasUnresolvedTaxLabel(option.taxLabel)
    && (!option.validTo || option.validTo >= today);
}

export function sortVenuePriceOptions(options: readonly VenuePriceOption[]) {
  return [...options].sort((a, b) => a.displayPriority - b.displayPriority || a.label.localeCompare(b.label));
}

export function getVenuePriceDisplays(
  options: readonly VenuePriceOption[] | null | undefined,
  legacyPriceFrom?: number | null,
  legacyPriceTo?: number | null
): VenuePriceDisplay[] {
  const displays = sortVenuePriceOptions(options ?? []).map(toVenuePriceDisplay);
  if (displays.length > 0) return displays;

  if (legacyPriceFrom == null && legacyPriceTo == null) return [];
  return [{
    option: null,
    label: "Indicative venue price",
    kindLabel: "Pricing",
    amountLabel: formatAmountRange(
      legacyPriceFrom == null ? null : legacyPriceFrom * 100,
      legacyPriceTo == null ? null : legacyPriceTo * 100,
      "GBP",
      "total",
      legacyPriceFrom != null && legacyPriceTo != null && legacyPriceTo > legacyPriceFrom ? "range" : "from"
    ),
    unit: "total",
    qualifier: legacyPriceFrom != null && legacyPriceTo != null && legacyPriceTo > legacyPriceFrom ? "range" : "from",
    isQuoteRequired: false,
    description: null,
    detailLabels: [],
    materialQualifierLabels: [],
    sourceUrl: null,
    verifiedAt: null
  }];
}

export function getPrimaryVenuePriceDisplay(
  options: readonly VenuePriceOption[] | null | undefined,
  legacyPriceFrom?: number | null,
  legacyPriceTo?: number | null
) {
  return getVenuePriceDisplays(options, legacyPriceFrom, legacyPriceTo)[0] ?? null;
}

export function selectBudgetPriceOption(options: readonly VenuePriceOption[] | null | undefined) {
  const sorted = sortVenuePriceOptions(options ?? []);
  return sorted.find((option) => {
    const unit = normaliseVenuePricingUnit(option.pricingUnit, option.kind);
    return option.amountFromPence != null
      && normaliseVenuePriceKind(option.kind) !== "minimum_spend"
      && (unit === "total" || unit === "per_event");
  }) ?? sorted.find((option) => normaliseVenuePricingUnit(option.pricingUnit, option.kind) === "per_person" && option.amountFromPence != null)
    ?? sorted.find((option) => normaliseVenuePriceKind(option.kind) === "minimum_spend" && option.amountFromPence != null)
    ?? sorted[0]
    ?? null;
}

export function venuePriceOptionToImportedType(option: VenuePriceOption | null, hasRange = false) {
  if (!option) return hasRange ? "range" as const : "starting_from" as const;
  const unit = normaliseVenuePricingUnit(option.pricingUnit, option.kind);
  const kind = normaliseVenuePriceKind(option.kind);
  const qualifier = normaliseVenuePriceQualifier(option.priceQualifier, option.kind, option.amountFromPence, option.amountToPence);
  if (unit === "quote" || kind === "quote_required" || option.amountFromPence == null) return "quote_required" as const;
  if (unit === "per_person") return "per_person" as const;
  if (kind === "wedding_package") return "package" as const;
  if (qualifier === "range") return "range" as const;
  if (qualifier === "fixed") return "fixed" as const;
  return "starting_from" as const;
}

export function formatVenuePriceOption(option: VenuePriceOption) {
  return toVenuePriceDisplay(option).amountLabel;
}

export function formatVerifiedDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(date);
}

export function formatPriceValidity(validFrom: string | null, validTo: string | null) {
  const from = formatDateOnly(validFrom);
  const to = formatDateOnly(validTo);
  if (from && to) return `Valid ${from} to ${to}`;
  if (from) return `Valid from ${from}`;
  if (to) return `Valid until ${to}`;
  return null;
}

function toVenuePriceDisplay(option: VenuePriceOption): VenuePriceDisplay {
  const kind = normaliseVenuePriceKind(option.kind);
  const unit = normaliseVenuePricingUnit(option.pricingUnit, option.kind);
  const qualifier = normaliseVenuePriceQualifier(option.priceQualifier, option.kind, option.amountFromPence, option.amountToPence);
  const quoteRequired = unit === "quote" || kind === "quote_required" || (option.amountFromPence == null && option.amountToPence == null);
  const validityLabel = formatPriceValidity(option.validFrom, option.validTo);
  const minimumNightsLabel = option.minimumNights ? `${option.minimumNights}-night minimum` : null;
  const materialQualifierLabels = [option.taxLabel, minimumNightsLabel, validityLabel]
    .filter((value): value is string => Boolean(value));
  const detailLabels = [
    option.seasonLabel,
    option.dayLabel,
    option.includedGuests ? `Includes up to ${option.includedGuests} guests` : null,
    ...materialQualifierLabels
  ]
    .filter((value): value is string => Boolean(value));

  return {
    option,
    label: option.label.trim() || KIND_LABELS[kind],
    kindLabel: KIND_LABELS[kind],
    amountLabel: quoteRequired
      ? "Contact venue for pricing"
      : formatAmountRange(option.amountFromPence, option.amountToPence, option.currency, unit, qualifier),
    unit,
    qualifier,
    isQuoteRequired: quoteRequired,
    description: option.description?.trim() || null,
    detailLabels,
    materialQualifierLabels,
    sourceUrl: option.sourceUrl,
    verifiedAt: option.verifiedAt
  };
}

function formatAmountRange(from: number | null, to: number | null, currency: string, unit: VenuePricingUnit, qualifier: VenuePriceQualifier) {
  const format = (value: number) => new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    minimumFractionDigits: value % 100 === 0 ? 0 : 2,
    maximumFractionDigits: value % 100 === 0 ? 0 : 2
  }).format(value / 100);
  let amount: string;
  if (qualifier === "range" && from != null && to != null && to > from) amount = `${format(from)}–${format(to)}`;
  else if (from != null) amount = qualifier === "fixed" ? format(from) : `From ${format(from)}`;
  else amount = `Up to ${format(to ?? 0)}`;
  const suffix = UNIT_SUFFIXES[unit];
  return suffix ? `${amount} ${suffix}` : amount;
}

function normaliseToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function formatDateOnly(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}
