import type { BudgetItem, BudgetPlan, PlannerListing } from "./types";
import { formatMoney } from "./calculations";
import { formatPriceValidity, hasUnresolvedTaxLabel } from "@/lib/venue-pricing";

export function formatPlannerListingPrice(listing: PlannerListing) {
  if (listing.pricingStatus === "quote_required") return "Contact venue for pricing";
  if (listing.priceFromPence == null && listing.priceToPence == null) return "Pricing being confirmed";
  const from = listing.priceFromPence;
  const to = listing.priceToPence;
  let amount: string;
  if (from != null && to != null && to > from) amount = `${formatListingMoney(from)}–${formatListingMoney(to)}`;
  else if (from != null) amount = listing.priceQualifier === "fixed" || listing.pricingStatus === "fixed"
    ? formatListingMoney(from)
    : `From ${formatListingMoney(from)}`;
  else amount = `Up to ${formatListingMoney(to ?? 0)}`;
  const suffix = listing.pricingUnit === "per_person" ? " per person"
    : listing.pricingUnit === "per_night" ? " per night"
      : listing.pricingUnit === "per_room" ? " per room"
        : listing.pricingUnit === "per_event" ? " per event"
          : listing.pricingUnit === "per_hour" ? " per hour"
            : listing.pricingUnit === "unspecified" ? " (basis not stated)"
          : "";
  const qualifiers = [
    listing.taxLabel,
    listing.minimumNights ? `${listing.minimumNights}-night minimum` : null,
    formatPriceValidity(listing.validFrom ?? null, listing.validTo ?? null)
  ].filter((value): value is string => Boolean(value));
  return `${amount}${suffix}${qualifiers.length ? ` · ${qualifiers.join(" · ")}` : ""}`;
}

export function plannerListingToBudgetItem(listing: PlannerListing, plan: BudgetPlan): BudgetItem {
  const now = new Date().toISOString();
  const isPerPerson = listing.pricingUnit === "per_person" || listing.pricingStatus === "per_person";
  const canUsePerPerson = isPerPerson && !hasUnresolvedTax(listing.taxLabel);
  const canUseAsTotal = plannerListingCanUseAsTotal(listing);
  const description = plannerListingDescription(listing);

  return {
    id: crypto.randomUUID(),
    categoryId: "venue",
    listingId: listing.id,
    listingType: listing.type,
    listingUrl: listing.listingUrl,
    imageUrl: listing.imageUrl,
    source: "website",
    itemName: listing.name,
    supplierName: listing.name,
    supplierType: listing.type,
    description,
    estimatedCostPence: canUseAsTotal ? listing.priceFromPence : null,
    confirmedCostPence: null,
    importedPricePence: listing.priceFromPence,
    importedPriceToPence: listing.priceToPence,
    importedPriceType: listing.pricingStatus,
    costPerPersonPence: canUsePerPerson ? listing.priceFromPence : null,
    guestCount: canUsePerPerson ? plan.guestCount : null,
    depositPaidPence: 0,
    totalPaidPence: 0,
    costStatus: "estimated",
    paymentStatus: "not_started",
    bookingStatus: "shortlisted",
    dueDate: null,
    websiteUrl: listing.listingUrl,
    notes: null,
    createdAt: now,
    updatedAt: now,
    sortOrder: plan.items.length
  };
}

export function plannerListingNeedsInput(listing: PlannerListing, guestCount: number | null) {
  if (listing.pricingUnit === "per_person" || listing.pricingStatus === "per_person") {
    return listing.priceFromPence == null || guestCount == null || hasUnresolvedTax(listing.taxLabel);
  }
  if (["per_night", "per_room", "per_hour", "unspecified", "quote"].includes(listing.pricingUnit ?? "")) return true;
  return listing.priceFromPence == null || listing.pricingStatus === "quote_required" || hasUnresolvedTax(listing.taxLabel);
}

export function plannerListingCanUseAsTotal(listing: PlannerListing) {
  const isPerPerson = listing.pricingUnit === "per_person" || listing.pricingStatus === "per_person";
  return listing.priceFromPence != null
    && !isPerPerson
    && !["per_night", "per_room", "per_hour", "unspecified", "quote"].includes(listing.pricingUnit ?? "")
    && listing.pricingStatus !== "quote_required"
    && !hasUnresolvedTax(listing.taxLabel);
}

export function plannerListingDescription(listing: PlannerListing) {
  const details = [
    listing.pricingDescription?.trim() || null,
    listing.pricingKind === "minimum_spend" ? "Minimum spend; the venue's final total may be higher." : null,
    listing.taxLabel ? `Tax: ${listing.taxLabel.replace(/[.\s]+$/, "")}.` : null,
    listing.minimumNights ? `Minimum stay: ${listing.minimumNights} night${listing.minimumNights === 1 ? "" : "s"}.` : null,
    formatPriceValidity(listing.validFrom ?? null, listing.validTo ?? null)
  ].filter((value): value is string => Boolean(value));
  return details.length ? [...new Set(details)].join(" ") : null;
}

export function hasUnresolvedTax(taxLabel: string | null | undefined) {
  return hasUnresolvedTaxLabel(taxLabel);
}

function formatListingMoney(pence: number) {
  return formatMoney(pence, "GBP", pence % 100 === 0 ? 0 : 2);
}
