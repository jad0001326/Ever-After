import { describe, expect, it } from "vitest";
import { INTERNAL_TEST_VENUE_SLUG_PREFIX, isInternalTestVenueRecord, isInternalTestVenueSlug } from "@/lib/internal-test-venue";

describe("internal test venue slugs", () => {
  it("recognises reserved internal test listings", () => {
    expect(isInternalTestVenueSlug(`${INTERNAL_TEST_VENUE_SLUG_PREFIX}claim-upload`)).toBe(true);
    expect(isInternalTestVenueRecord({
      slug: "published-looking-slug",
      name: "EverAft Internal Test Venue",
      region: "Midlothian"
    })).toBe(true);
    expect(isInternalTestVenueRecord({
      slug: "beach-ballroom",
      name: "Beach Ballroom",
      region: "Internal QA"
    })).toBe(true);
  });

  it("does not classify normal venue slugs as tests", () => {
    expect(isInternalTestVenueSlug("blackshaw-barns")).toBe(false);
    expect(isInternalTestVenueRecord({
      slug: "beach-ballroom",
      name: "Beach Ballroom",
      region: "Aberdeen City"
    })).toBe(false);
  });
});
