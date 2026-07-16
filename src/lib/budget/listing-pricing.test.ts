import { describe, expect, it } from "vitest";
import { createEmptyBudgetPlan } from "./persistence";
import type { PlannerListing } from "./types";
import { formatPlannerListingPrice, plannerListingNeedsInput, plannerListingToBudgetItem } from "./listing-pricing";

function listing(overrides: Partial<PlannerListing> = {}): PlannerListing {
  return {
    id: "venue-1",
    slug: "venue-one",
    name: "Venue One",
    type: "Country Estate",
    categoryId: "venue",
    location: "Perth, Perthshire",
    imageUrl: "/venue.jpg",
    listingUrl: "/venues/venue-one",
    priceFromPence: 9_500,
    priceToPence: null,
    pricingStatus: "per_person",
    pricingKind: "per_person",
    pricingLabel: "Wedding breakfast",
    pricingUnit: "per_person",
    ...overrides
  };
}

describe("budget listing pricing", () => {
  it("calculates a per-person planning cost only when a guest count is available", () => {
    const plan = { ...createEmptyBudgetPlan(), guestCount: 80 };
    const item = plannerListingToBudgetItem(listing(), plan);
    expect(item.estimatedCostPence).toBeNull();
    expect(item.costPerPersonPence).toBe(9_500);
    expect(item.guestCount).toBe(80);
    expect(plannerListingNeedsInput(listing(), 80)).toBe(false);
    expect(plannerListingNeedsInput(listing(), null)).toBe(true);
  });

  it("never treats a room or nightly amount as the venue total", () => {
    const nightly = listing({ pricingStatus: "starting_from", pricingKind: "accommodation", pricingUnit: "per_night", priceFromPence: 20_000 });
    expect(plannerListingToBudgetItem(nightly, createEmptyBudgetPlan()).estimatedCostPence).toBeNull();
    expect(plannerListingNeedsInput(nightly, 80)).toBe(true);
    expect(formatPlannerListingPrice(nightly)).toBe("From £200 per night");
  });

  it("preserves and labels a minimum spend as an estimate", () => {
    const minimum = listing({ pricingStatus: "starting_from", pricingKind: "minimum_spend", pricingUnit: "total", priceFromPence: 500_000 });
    const item = plannerListingToBudgetItem(minimum, createEmptyBudgetPlan());
    expect(item.estimatedCostPence).toBe(500_000);
    expect(item.description).toMatch(/minimum spend/i);
  });

  it("does not turn a fixed published amount into a from price", () => {
    const fixed = listing({ pricingStatus: "fixed", pricingUnit: "total", priceQualifier: "fixed", priceFromPence: 500_000 });
    expect(formatPlannerListingPrice(fixed)).toBe("£5,000");
    expect(plannerListingToBudgetItem(fixed, createEmptyBudgetPlan()).estimatedCostPence).toBe(500_000);
  });

  it.each(["per_hour", "unspecified"])("requires manual input for a %s price", (pricingUnit) => {
    const ambiguous = listing({ pricingStatus: "starting_from", pricingKind: "venue_hire", pricingUnit, priceFromPence: 25_000 });
    expect(plannerListingToBudgetItem(ambiguous, createEmptyBudgetPlan()).estimatedCostPence).toBeNull();
    expect(plannerListingNeedsInput(ambiguous, 80)).toBe(true);
  });

  it("shows material qualifiers and never imports a VAT-exclusive base price as the total", () => {
    const taxed = listing({
      pricingStatus: "starting_from",
      pricingKind: "venue_hire",
      pricingUnit: "total",
      priceFromPence: 199_500,
      pricingDescription: "Evening venue hire.",
      taxLabel: "VAT additional",
      minimumNights: 2,
      validFrom: "2026-01-01",
      validTo: "2026-12-31"
    });
    const item = plannerListingToBudgetItem(taxed, createEmptyBudgetPlan());

    expect(formatPlannerListingPrice(taxed)).toBe("From £1,995 · VAT additional · 2-night minimum · Valid 1 Jan 2026 to 31 Dec 2026");
    expect(item.estimatedCostPence).toBeNull();
    expect(item.importedPricePence).toBe(199_500);
    expect(item.description).toContain("Tax: VAT additional.");
    expect(plannerListingNeedsInput(taxed, 80)).toBe(true);
  });

  it("does not calculate a per-person total when VAT remains additional", () => {
    const taxedPerPerson = listing({ taxLabel: "VAT additional" });
    const item = plannerListingToBudgetItem(taxedPerPerson, { ...createEmptyBudgetPlan(), guestCount: 80 });

    expect(item.costPerPersonPence).toBeNull();
    expect(item.importedPricePence).toBe(9_500);
    expect(plannerListingNeedsInput(taxedPerPerson, 80)).toBe(true);
  });
});
