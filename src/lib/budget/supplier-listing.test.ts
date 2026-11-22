import { describe, expect, it } from "vitest";
import {
  activeSupplierRowToPlannerListing,
  type BudgetPlannerSupplierRow,
} from "./supplier-listing";

function supplier(overrides: Partial<BudgetPlannerSupplierRow> = {}): BudgetPlannerSupplierRow {
  return {
    id: "supplier-1",
    slug: "north-light",
    name: "North Light",
    category_slug: "photographer",
    base_town: "Edinburgh",
    region: "City of Edinburgh",
    hero_image_url: null,
    image_permission_status: "representative",
    starting_price_pence: null,
    typical_price_pence: null,
    pricing_summary: null,
    pricing_unit: "quote",
    ...overrides,
  };
}

describe("Budget Planner supplier mapping", () => {
  it("maps a live Photography profile to its real planner category and canonical URL", () => {
    expect(activeSupplierRowToPlannerListing(supplier())).toMatchObject({
      categoryId: "photography",
      type: "Photographer",
      listingUrl: "/photographers/north-light",
      pricingStatus: "quote_required",
      imageUrl: "/everaft-logo-mark.svg",
    });
  });

  it("maps a live videographer and excludes categories that are not launched", () => {
    expect(activeSupplierRowToPlannerListing(supplier({
      category_slug: "videographer",
      slug: "channel-one",
      name: "Channel One Wedding Films",
      base_town: "Lancaster",
      region: "Lancashire",
    }))).toMatchObject({
      categoryId: "videography",
      type: "Videographer",
      listingUrl: "/suppliers/videographer/channel-one",
      location: "Lancaster, Lancashire",
    });
    expect(activeSupplierRowToPlannerListing(supplier({ category_slug: "florist" }))).toBeNull();
    expect(activeSupplierRowToPlannerListing(supplier({ category_slug: "unknown" }))).toBeNull();
  });
});
