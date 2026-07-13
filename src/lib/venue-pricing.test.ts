import { describe, expect, it } from "vitest";
import type { VenuePriceOption } from "@/types/venue";
import {
  getPrimaryVenuePriceDisplay,
  getVenuePriceDisplays,
  isEligibleVenueSummaryPrice,
  normaliseVenuePricingUnit,
  selectBudgetPriceOption
} from "./venue-pricing";

function option(overrides: Partial<VenuePriceOption> = {}): VenuePriceOption {
  return {
    id: "price-1",
    venueId: "venue-1",
    kind: "wedding_package",
    label: "Summer wedding package",
    amountFromPence: 750_000,
    amountToPence: null,
    currency: "GBP",
    pricingUnit: "total",
    priceQualifier: "from",
    includedGuests: 80,
    seasonLabel: "May to September",
    dayLabel: "Saturday",
    description: null,
    taxLabel: null,
    minimumNights: null,
    validFrom: null,
    validTo: null,
    sourceUrl: "https://venue.example/pricing",
    verifiedAt: "2026-07-13T10:00:00Z",
    displayPriority: 10,
    ...overrides
  };
}

describe("venue pricing", () => {
  it("clearly labels total and per-person prices", () => {
    expect(getPrimaryVenuePriceDisplay([option()])?.amountLabel).toBe("From £7,500");
    expect(getPrimaryVenuePriceDisplay([option({ kind: "per_person", pricingUnit: "pp", amountFromPence: 9_500 })])?.amountLabel).toBe("From £95 per person");
  });

  it("renders fixed amounts without implying that they are starting prices", () => {
    expect(getPrimaryVenuePriceDisplay([option({ priceQualifier: "fixed" })])?.amountLabel).toBe("£7,500");
    expect(getPrimaryVenuePriceDisplay([option({ priceQualifier: "from" })])?.amountLabel).toBe("From £7,500");
    expect(getPrimaryVenuePriceDisplay([option({ priceQualifier: "fixed", amountFromPence: 9_950 })])?.amountLabel).toBe("£99.50");
  });

  it("keeps quote-only pricing distinct from missing pricing", () => {
    const quote = getPrimaryVenuePriceDisplay([option({ kind: "quote_required", pricingUnit: "quote", amountFromPence: null })]);
    expect(quote?.amountLabel).toBe("Contact venue for pricing");
    expect(quote?.isQuoteRequired).toBe(true);
    expect(getVenuePriceDisplays([], null, null)).toEqual([]);
  });

  it("uses legacy pound values only when typed options are absent", () => {
    expect(getPrimaryVenuePriceDisplay([], 4_500, 6_000)?.amountLabel).toBe("£4,500–£6,000");
    expect(getPrimaryVenuePriceDisplay([option()], 1, 2)?.amountLabel).toBe("From £7,500");
  });

  it("prefers safe event totals for budget imports, then per-person prices", () => {
    const nightly = option({ id: "night", kind: "accommodation", pricingUnit: "per_night", amountFromPence: 20_000, displayPriority: 1 });
    const perPerson = option({ id: "person", kind: "per_person", pricingUnit: "per_person", amountFromPence: 9_500, displayPriority: 2 });
    const total = option({ id: "total", pricingUnit: "total", amountFromPence: 800_000, displayPriority: 3 });
    expect(selectBudgetPriceOption([nightly, perPerson, total])?.id).toBe("total");
    expect(selectBudgetPriceOption([nightly, perPerson])?.id).toBe("person");
    expect(normaliseVenuePricingUnit("per head", "other")).toBe("per_person");
  });

  it("does not choose a minimum spend while a genuine total is available", () => {
    const minimum = option({ id: "minimum", kind: "minimum_spend", amountFromPence: 500_000, displayPriority: 1 });
    const total = option({ id: "hire", kind: "venue_hire", amountFromPence: 700_000, displayPriority: 2 });
    expect(getPrimaryVenuePriceDisplay([minimum])?.kindLabel).toBe("Minimum spend");
    expect(selectBudgetPriceOption([minimum, total])?.id).toBe("hire");
    expect(selectBudgetPriceOption([minimum])?.id).toBe("minimum");
  });

  it("never normalises hourly or unspecified evidence into a total", () => {
    expect(normaliseVenuePricingUnit("per_hour", "venue_hire")).toBe("per_hour");
    expect(normaliseVenuePricingUnit("unspecified", "wedding_package")).toBe("unspecified");
    expect(getPrimaryVenuePriceDisplay([option({ pricingUnit: "per_hour", amountFromPence: 25_000 })])?.amountLabel).toMatch(/per hour$/);
    expect(getPrimaryVenuePriceDisplay([option({ pricingUnit: "unspecified", amountFromPence: 25_000 })])?.amountLabel).toMatch(/basis not stated$/);
  });

  it("preserves material tax, stay, validity and description context", () => {
    const display = getPrimaryVenuePriceDisplay([option({
      description: "Exclusive house use with accommodation.",
      taxLabel: "VAT additional",
      minimumNights: 2,
      validFrom: "2026-01-01",
      validTo: "2026-12-31"
    })]);

    expect(display?.description).toBe("Exclusive house use with accommodation.");
    expect(display?.materialQualifierLabels).toEqual([
      "VAT additional",
      "2-night minimum",
      "Valid 1 Jan 2026 to 31 Dec 2026"
    ]);
    expect(display?.detailLabels).toEqual(expect.arrayContaining(display.materialQualifierLabels));
  });

  it("keeps unresolved tax and expired prices out of the legacy search summary", () => {
    const base = option({ kind: "venue_hire", pricingUnit: "total", validTo: "2026-12-31" });
    expect(isEligibleVenueSummaryPrice(base, "2026-07-13")).toBe(true);
    expect(isEligibleVenueSummaryPrice({ ...base, taxLabel: "VAT additional" }, "2026-07-13")).toBe(false);
    expect(isEligibleVenueSummaryPrice({ ...base, validTo: "2025-12-31" }, "2026-07-13")).toBe(false);
  });
});
