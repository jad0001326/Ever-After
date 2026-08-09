import { describe, expect, it } from "vitest";
import { getVenueListingHealth } from "./listing-health";

const completeListing = {
  official_website_url: "https://venue.example",
  official_gallery_url: "https://venue.example/gallery",
  vendor_contact_email: "weddings@venue.example",
  image_is_representative: false,
  summary: "A venue summary",
  description: "A full venue description"
};

describe("venue listing health", () => {
  it("uses the same six completion checks for the dashboard and reminders", () => {
    expect(getVenueListingHealth(completeListing)).toEqual({ score: 6, total: 6, missing: [] });
  });

  it("treats whitespace copy and representative imagery as incomplete", () => {
    expect(getVenueListingHealth({
      ...completeListing,
      official_gallery_url: null,
      image_is_representative: true,
      summary: "  "
    })).toEqual({
      score: 3,
      total: 6,
      missing: ["add official gallery", "submit approved photography", "review summary"]
    });
  });
});
