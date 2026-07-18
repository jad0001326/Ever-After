import { describe, expect, it } from "vitest";
import { INTERNAL_TEST_VENUE_SLUG_PREFIX, isInternalTestVenueSlug } from "@/lib/internal-test-venue";

describe("internal test venue slugs", () => {
  it("recognises reserved internal test listings", () => {
    expect(isInternalTestVenueSlug(`${INTERNAL_TEST_VENUE_SLUG_PREFIX}claim-upload`)).toBe(true);
  });

  it("does not classify normal venue slugs as tests", () => {
    expect(isInternalTestVenueSlug("blackshaw-barns")).toBe(false);
  });
});
