import { describe, expect, it } from "vitest";
import {
  auditVenues,
  detectVenueDuplicates,
  evaluateInitialInviteBlockers,
  isContactForPriceText,
  parsePricingText,
  type AuditableVenue
} from "./audit";

function venue(overrides: Partial<AuditableVenue> = {}): AuditableVenue {
  return {
    id: "venue-1",
    slug: "rose-hall",
    name: "Rose Hall Ltd",
    type: "Country Estate",
    town: "Perth",
    region: "Perthshire",
    country: "Scotland",
    summary: "An exclusive-use wedding venue.",
    description: "Rose Hall hosts weddings and private celebrations in Perthshire.",
    price_from: 3_500,
    price_to: 8_500,
    capacity_min: 20,
    capacity_max: 120,
    official_website_url: "https://rosehall.co.uk",
    vendor_contact_email: "weddings@rosehall.co.uk",
    vendor_contact_source_url: "https://rosehall.co.uk/contact",
    listing_status: "published",
    is_claimed: false,
    invite_status: "not_sent",
    latitude: 56.395,
    longitude: -3.43,
    amenity_count: 4,
    image_is_representative: false,
    business_status: "active",
    ...overrides
  };
}

describe("initial outreach blocker audit", () => {
  it("models the current initial-invite rules without treating broader quality as eligibility", () => {
    const record = venue({ price_from: null, price_to: null, image_is_representative: true });
    const result = auditVenues([record]);
    expect(result.audits[0].eligibleUnderCurrentRules).toBe(true);
    expect(result.audits[0].actualEligibilityBlockers).toEqual([]);
    expect(result.audits[0].dataQualityIssues).toEqual(expect.arrayContaining(["missing_price", "representative_image"]));
  });

  it("reports all direct current-rule blockers", () => {
    const blockers = evaluateInitialInviteBlockers(venue({
      country: "England",
      is_claimed: true,
      listing_status: "draft",
      invite_status: "sent",
      vendor_contact_email: null
    }));
    expect(blockers).toEqual(["claimed", "listing_not_published", "country_mismatch", "invite_not_available", "missing_email"]);
  });

  it("requires an official-host contact source", () => {
    expect(evaluateInitialInviteBlockers(venue({ vendor_contact_source_url: "https://directory.example/rose-hall" }))).toContain("unverified_contact");
  });

  it("models unsubscribed and bounced addresses through the normalized suppression input", () => {
    const unsubscribed = auditVenues([venue()], { suppressedEmails: [" WEDDINGS@ROSEHALL.CO.UK "] });
    const bounced = auditVenues([venue()], { suppressedEmails: new Set(["weddings@rosehall.co.uk"]) });
    expect(unsubscribed.audits[0].actualEligibilityBlockers).toContain("suppressed");
    expect(bounced.audits[0].actualEligibilityBlockers).toContain("suppressed");
  });

  it("blocks venues with existing or active outreach history when that protected context is available", () => {
    const result = auditVenues([venue()], { existingOutreachVenueIds: ["venue-1"] });
    expect(result.audits[0].actualEligibilityBlockers).toContain("existing_outreach");
  });

  it("allows a shared operator inbox while retaining identity duplicates as quality signals", () => {
    const records = [
      venue(),
      venue({ id: "venue-2", slug: "fern-barn", name: "Fern Barn", official_website_url: "https://fernbarn.co.uk", vendor_contact_email: "weddings@rosehall.co.uk", vendor_contact_source_url: "https://fernbarn.co.uk/contact" })
    ];
    const result = auditVenues(records);
    expect(result.audits[0].actualEligibilityBlockers).not.toContain("duplicate_email");
    expect(result.audits[1].actualEligibilityBlockers).not.toContain("duplicate_email");
    expect(result.audits.every((audit) => !audit.dataQualityIssues.includes("possible_duplicate"))).toBe(true);
    expect(result.duplicateMatches).toContainEqual(expect.objectContaining({ kind: "email", venueIds: ["venue-1", "venue-2"] }));
  });

  it("still flags matching venue identity signals as possible duplicates", () => {
    const result = auditVenues([
      venue(),
      venue({ id: "venue-2", slug: "rose-hall-estate", name: "Rose Hall", vendor_contact_email: "weddings@rosehall.co.uk" })
    ]);
    expect(result.audits.every((audit) => audit.dataQualityIssues.includes("possible_duplicate"))).toBe(true);
  });

  it("detects normalized name and location duplicates without requiring matching emails", () => {
    const matches = detectVenueDuplicates([
      venue(),
      venue({ id: "venue-2", name: "Rose Hall", official_website_url: "https://other.example", vendor_contact_email: "hello@other.example", vendor_contact_source_url: "https://other.example/contact" })
    ]);
    expect(matches).toContainEqual(expect.objectContaining({ kind: "name_location", venueIds: ["venue-1", "venue-2"] }));
  });

  it("keeps closed-business status out of current code blockers but prevents an outreach recommendation", () => {
    const audit = auditVenues([venue({ business_status: "closed" })]).audits[0];
    expect(audit.eligibleUnderCurrentRules).toBe(true);
    expect(audit.actualEligibilityBlockers).toEqual([]);
    expect(audit.dataQualityIssues).toContain("business_closed");
    expect(audit.recommendedForOutreach).toBe(false);
    expect(audit.requiresManualReview).toBe(true);
  });

  it("is deterministic and idempotent when rerun with the same inputs", () => {
    const records = [venue(), venue({ id: "venue-2", name: "Fern Barn", slug: "fern-barn", official_website_url: "https://fernbarn.co.uk", vendor_contact_email: "hello@fernbarn.co.uk", vendor_contact_source_url: "https://fernbarn.co.uk/contact" })];
    expect(auditVenues(records, { suppressedEmails: [] })).toEqual(auditVenues(records, { suppressedEmails: [] }));
  });

  it("aggregates eligibility, blocker, quality, and pricing counts", () => {
    const result = auditVenues([venue(), venue({ id: "venue-2", name: "Fern Barn", vendor_contact_email: null, price_from: null, price_to: null, pricing_text: "Prices available on request" })]);
    expect(result.summary).toMatchObject({ total: 2, eligibleUnderCurrentRules: 1, ineligibleUnderCurrentRules: 1 });
    expect(result.summary.actualBlockerCounts.missing_email).toBe(1);
    expect(result.summary.pricingStatusCounts.contact_for_price).toBe(1);
  });
});

describe("conservative pricing parsing", () => {
  it("recognizes contact-for-price language without inventing an amount", () => {
    expect(isContactForPriceText("Our wedding prices are available on request.")).toBe(true);
    expect(parsePricingText("Our wedding prices are available on request.")).toEqual({
      status: "contact_for_price",
      currency: null,
      amounts: [],
      startingPrice: null,
      maximumPublishedPrice: null,
      basis: "unspecified"
    });
  });

  it("parses explicitly currency-marked ranges and their basis", () => {
    expect(parsePricingText("Wedding packages from £3,500 to £8,500 per event")).toEqual({
      status: "published",
      currency: "GBP",
      amounts: [3_500, 8_500],
      startingPrice: 3_500,
      maximumPublishedPrice: 8_500,
      basis: "per_event"
    });
  });

  it("does not treat guest counts or deposits as a published starting price", () => {
    expect(parsePricingText("Capacity 120 guests; contact us for a quote").status).toBe("contact_for_price");
    expect(parsePricingText("£500 deposit; full pricing on request").status).toBe("contact_for_price");
  });
});
