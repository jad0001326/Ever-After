import { describe, expect, it } from "vitest";
import {
  buildSupplierCatalogueAudit,
  type SupplierAuditListing,
} from "./supplier-catalogue-audit";

const completeListing: SupplierAuditListing = {
  id: "supplier-1",
  category_slug: "photographer",
  name: "North Light",
  base_town: "Edinburgh",
  region: "Edinburgh and Lothians",
  summary: "Documentary wedding photography.",
  description: "Natural photographs of Scottish celebrations.",
  services: ["Full-day photography"],
  source_url: "https://example.com/profile-source",
  official_website_url: "https://example.com",
  starting_price_pence: 150000,
  typical_price_pence: null,
  pricing_summary: null,
  pricing_unit: "package",
  hero_image_url: "https://example.com/image.jpg",
  image_permission_status: "approved",
  listing_status: "published",
  claim_status: "unclaimed",
  is_claimed: false,
};

describe("buildSupplierCatalogueAudit", () => {
  it("separates publication, claim and profile-readiness evidence", () => {
    const audit = buildSupplierCatalogueAudit({
      generatedAt: "2026-08-03T12:00:00.000Z",
      categories: [{
        slug: "photographer",
        name: "Photographer",
        plural_name: "Photographers",
        is_live: true,
        sort_order: 1,
      }],
      listings: [
        completeListing,
        {
          ...completeListing,
          id: "supplier-2",
          name: "Incomplete Studio",
          listing_status: "draft",
          claim_status: "pending",
          starting_price_pence: null,
          pricing_summary: "Pricing supplied after consultation",
          pricing_unit: "quote",
          hero_image_url: null,
          image_permission_status: "pending",
          source_url: null,
          official_website_url: null,
        },
      ],
      images: [{ supplier_id: "supplier-2", permission_status: "approved" }],
      claims: [{ supplier_id: "supplier-2", status: "pending" }],
    });

    expect(audit.totals).toMatchObject({
      listings: 2,
      draft: 1,
      published: 1,
      openClaims: 1,
      completePublishedProfiles: 1,
    });
    expect(audit.categories[0]).toMatchObject({
      databaseLive: true,
      withPricingOrQuoteHandling: 2,
      withApprovedOrRepresentativeVisual: 2,
      withSourceProvenance: 1,
      completePublishedProfiles: 1,
    });
  });

  it("includes listing categories missing from the taxonomy and flags duplicate groups", () => {
    const audit = buildSupplierCatalogueAudit({
      generatedAt: "2026-08-03T12:00:00.000Z",
      categories: [],
      listings: [
        { ...completeListing, id: "one", category_slug: "florist", name: "Bloom & Co" },
        { ...completeListing, id: "two", category_slug: "florist", name: "Bloom and Co" },
        { ...completeListing, id: "three", category_slug: "florist", name: "Bloom & Co" },
      ],
      images: [],
      claims: [],
    });

    expect(audit.categories).toHaveLength(1);
    expect(audit.categories[0]).toMatchObject({
      slug: "florist",
      databaseLive: false,
      total: 3,
      potentialDuplicateGroups: 1,
    });
  });
});
