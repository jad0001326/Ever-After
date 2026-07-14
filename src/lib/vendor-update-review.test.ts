import { describe, expect, it } from "vitest";
import { buildVenueUpdateComparisons, type VenueUpdateReviewVenue } from "./vendor-update-review";

const venue: VenueUpdateReviewVenue = {
  name: "Existing venue",
  summary: "Existing summary",
  description: "Existing description",
  official_website_url: "https://example.com",
  official_gallery_url: null
};

describe("buildVenueUpdateComparisons", () => {
  it("shows submitted pending fields and marks real changes", () => {
    const comparisons = buildVenueUpdateComparisons({
      status: "pending",
      requested_name: "Existing venue",
      requested_summary: "A better summary",
      requested_description: null,
      requested_official_website_url: null,
      requested_official_gallery_url: null,
      previous_values: null,
      applied_values: null
    }, venue);

    expect(comparisons).toEqual([
      { key: "name", label: "Venue name", before: "Existing venue", after: "Existing venue", changed: false },
      { key: "summary", label: "Listing summary", before: "Existing summary", after: "A better summary", changed: true }
    ]);
  });

  it("uses the stored audit snapshots after approval", () => {
    const comparisons = buildVenueUpdateComparisons({
      status: "approved",
      requested_name: null,
      requested_summary: "Approved summary",
      requested_description: null,
      requested_official_website_url: null,
      requested_official_gallery_url: null,
      previous_values: { summary: "Original summary" },
      applied_values: { summary: "Approved summary" }
    }, { ...venue, summary: "A later admin edit" });

    expect(comparisons[0]).toEqual({
      key: "summary",
      label: "Listing summary",
      before: "Original summary",
      after: "Approved summary",
      changed: true
    });
  });
});
