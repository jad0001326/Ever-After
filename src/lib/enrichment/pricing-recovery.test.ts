import { describe, expect, it } from "vitest";
import {
  buildPricingRecovery,
  createPricingSourceFingerprint,
  pricingOptionsToCsv
} from "./pricing-recovery.ts";

const venueId = "11111111-1111-4111-8111-111111111111";

describe("pricing recovery", () => {
  it("normalizes legacy findings, retains useful conditions, and removes duplicates deterministically", () => {
    const finding = {
      amount: 5000,
      currency: "GBP",
      context: "Our Winter wedding package starts from £5,000 for up to 60 day guests on Saturday.",
      sourceUrl: "https://venue.test/weddings/prices"
    };
    const report = buildPricingRecovery(auditWith({ publishedPrices: [finding, finding] }));

    expect(report.options).toHaveLength(1);
    expect(report.options[0]).toMatchObject({
      venueId,
      kind: "wedding_package",
      amountFromPence: 500_000,
      amountToPence: null,
      pricingUnit: "total",
      includedGuests: 60,
      seasonLabel: "Winter",
      dayLabel: "Saturday",
      autoPublishEligible: true,
      requiresManualReview: false,
      status: "draft"
    });
    expect(report.summary.duplicateFindingsRemoved).toBe(1);
    expect(report.rejectedFindings).toContainEqual(expect.objectContaining({ reason: "duplicate_finding" }));
    expect(buildPricingRecovery(auditWith({ publishedPrices: [finding, finding] }))).toEqual(report);
  });

  it("combines both endpoints of an explicit official range into one draft option", () => {
    const context = "Wedding venue hire ranges from £4,000 - £6,000, Monday to Thursday.";
    const report = buildPricingRecovery(auditWith({
      publishedPrices: [
        { amount: 4000, currency: "GBP", context, sourceUrl: "https://venue.test/weddings" },
        { amount: 6000, currency: "GBP", context, sourceUrl: "https://venue.test/weddings" }
      ]
    }));

    expect(report.options).toHaveLength(1);
    expect(report.options[0]).toMatchObject({
      kind: "venue_hire",
      amountFromPence: 400_000,
      amountToPence: 600_000,
      dayLabel: "Monday to Thursday"
    });
    expect(report.summary.explicitRangesCombined).toBe(1);
  });

  it("preserves pence when combining a decimal range", () => {
    const context = "Wedding packages range from £95.50 - £125.75 per person.";
    const report = buildPricingRecovery(auditWith({
      publishedPrices: [
        { amount: 95.5, currency: "GBP", context, sourceUrl: "https://venue.test/weddings" },
        { amount: 125.75, currency: "GBP", context, sourceUrl: "https://venue.test/weddings" }
      ]
    }));

    expect(report.options).toHaveLength(1);
    expect(report.options[0]).toMatchObject({ amountFromPence: 9_550, amountToPence: 12_575, pricingUnit: "per_person" });
  });

  it("rejects discounts and deposits instead of turning them into venue prices", () => {
    const report = buildPricingRecovery(auditWith({
      publishedPrices: [
        { amount: 1000, currency: "GBP", context: "Save £1,000 off your wedding package this month.", sourceUrl: "https://venue.test/offers" },
        { amount: 250, currency: "GBP", context: "A £250 wedding booking deposit is required.", sourceUrl: "https://venue.test/terms" }
      ]
    }));

    expect(report.options).toHaveLength(0);
    expect(report.rejectedFindings).toHaveLength(2);
    expect(report.rejectedFindings.every((finding) => finding.reason === "unsafe_or_unrelated_price")).toBe(true);
  });

  it("creates a source-backed quote-required draft but never publishes it", () => {
    const report = buildPricingRecovery(auditWith({
      pricingStatus: "contact_for_price",
      publishedPrices: [],
      evidence: [{
        sourceUrl: "https://venue.test/weddings",
        sourceType: "official_pricing",
        accessedAt: "2026-07-13T10:00:00.000Z",
        notes: "Official page directs visitors to enquire for current wedding pricing."
      }]
    }));

    expect(report.options).toHaveLength(1);
    expect(report.options[0]).toMatchObject({
      kind: "quote_required",
      pricingUnit: "quote",
      amountFromPence: null,
      amountToPence: null,
      autoPublishEligible: true,
      status: "draft"
    });
    expect(report.summary.databaseWrites).toBe(0);
    expect(report.summary.emailsSent).toBe(0);
  });

  it("marks otherwise valid evidence for review when it is not on the official host", () => {
    const report = buildPricingRecovery(auditWith({
      publishedPrices: [{
        amount: 7500,
        currency: "GBP",
        context: "Our exclusive-use wedding price starts from £7,500.",
        sourceUrl: "https://directory.example/venue"
      }]
    }));

    expect(report.options[0]).toMatchObject({ autoPublishEligible: false, requiresManualReview: true });
    expect(report.options[0].reviewReasons).toContain("source_host_not_official");
  });

  it("does not auto-clear a nearby component charge or a unit borrowed from another amount", () => {
    const report = buildPricingRecovery(auditWith({
      publishedPrices: [
        {
          amount: 360,
          currency: "GBP",
          context: "Use of small garden to rear of Castle: £360 Exclusive use of the Castle for your event: see below.",
          sourceUrl: "https://venue.test/prices"
        },
        {
          amount: 650,
          currency: "GBP",
          context: "Evening wedding venue hire from £650. Up to 150 seated guests. Drinks packages from £12 per person.",
          sourceUrl: "https://venue.test/weddings"
        }
      ]
    }));

    expect(report.options).toHaveLength(2);
    expect(report.options.every((option) => option.requiresManualReview)).toBe(true);
    expect(report.options.flatMap((option) => option.reviewReasons)).toEqual(expect.arrayContaining([
      "nearby_component_charge_may_be_misattributed",
      "pricing_unit_not_attached_to_exact_amount"
    ]));
  });

  it("keeps VAT-bearing evidence as a draft requiring review", () => {
    const report = buildPricingRecovery(auditWith({
      publishedPrices: [{
        amount: 12500,
        currency: "GBP",
        context: "Winter wedding package from £12,500 + VAT, including exclusive venue hire.",
        sourceUrl: "https://venue.test/winter-weddings"
      }]
    }));

    expect(report.options[0].reviewReasons).toContain("tax_or_surcharge_requires_review");
    expect(report.options[0].status).toBe("draft");
  });

  it("stores only a short amount-centred evidence excerpt", () => {
    const padding = "Wedding celebrations at our estate include thoughtful planning support. ".repeat(8);
    const report = buildPricingRecovery(auditWith({
      publishedPrices: [{
        amount: 5000,
        currency: "GBP",
        context: `${padding}Our wedding package starts from £5,000.${padding}`,
        sourceUrl: "https://venue.test/weddings"
      }]
    }));

    expect(report.options[0].evidenceText.length).toBeLessThanOrEqual(300);
    expect(report.options[0].evidenceText).toContain("£5,000");
  });

  it("uses a stable fingerprint and emits spreadsheet-safe CSV", () => {
    const report = buildPricingRecovery(auditWith({
      publishedPrices: [{
        amount: 95,
        currency: "GBP",
        context: "Our wedding package starts from £95 per person, including dinner.",
        sourceUrl: "https://venue.test/weddings"
      }]
    }));
    const option = report.options[0];

    expect(createPricingSourceFingerprint(option)).toBe(option.sourceFingerprint);
    expect(pricingOptionsToCsv([{ ...option, evidenceText: 'Price includes dinner, drinks and a "toast".' }]))
      .toContain('"Price includes dinner, drinks and a ""toast""."');
  });

  it("keeps source-backed yearly and package variants distinct", () => {
    const common = {
      fingerprintVersion: 2 as const,
      venueId,
      kind: "wedding_package" as const,
      pricingUnit: "total" as const,
      amountFromPence: 180_000,
      amountToPence: null,
      sourceUrl: "https://venue.test/weddings",
      includedGuests: 12,
      seasonLabel: null,
      dayLabel: null,
      taxLabel: null,
      minimumNights: null
    };

    expect(createPricingSourceFingerprint({ ...common, label: "Small wedding - 2026", validFrom: "2026-01-01", validTo: "2026-12-31", qualifier: "fixed" }))
      .not.toBe(createPricingSourceFingerprint({ ...common, label: "Small wedding - 2027", validFrom: "2027-01-01", validTo: "2027-12-31", qualifier: "fixed" }));
    expect(createPricingSourceFingerprint({ ...common, label: "Intimate wedding package", validFrom: null, validTo: null, qualifier: "fixed" }))
      .not.toBe(createPricingSourceFingerprint({ ...common, label: "Winter wedding package", validFrom: null, validTo: null, qualifier: "fixed" }));
    expect(createPricingSourceFingerprint({ ...common, label: "Wedding package", validFrom: null, validTo: null, qualifier: "fixed" }))
      .not.toBe(createPricingSourceFingerprint({ ...common, label: "Wedding package", validFrom: null, validTo: null, qualifier: "from" }));
  });
});

function auditWith(researchOverrides: Record<string, unknown>) {
  return {
    summary: {
      generatedAt: "2026-07-13T10:00:00.000Z",
      mode: "dry_run",
      databaseWrites: 0,
      emailsSent: 0
    },
    records: [{
      entityType: "venue",
      entityId: venueId,
      businessName: "Test Venue",
      slug: "test-venue"
    }],
    researchResults: [{
      targetId: venueId,
      businessName: "Test Venue",
      officialWebsiteUrl: "https://venue.test/",
      status: "completed",
      checkedAt: "2026-07-13T09:00:00.000Z",
      pricingStatus: "published",
      publishedPrices: [],
      evidence: [],
      pagesChecked: ["https://venue.test/weddings"],
      ...researchOverrides
    }]
  };
}
