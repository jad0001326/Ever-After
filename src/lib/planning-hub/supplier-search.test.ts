import { describe, expect, it } from "vitest";
import {
  getLivePlanningHubSupplierCategory,
  getPlanningHubSupplierCategory,
  isSupplierCategorySlug,
  normalisePlanningHubSupplierSearchParams,
  PLANNING_HUB_SUPPLIER_PAGE_SIZE,
} from "./supplier-search";

describe("Planning Hub supplier search", () => {
  it("normalises and bounds category-neutral URL filters", () => {
    expect(normalisePlanningHubSupplierSearchParams({
      search: "  Highland   films  ",
      venue: " venue-id ",
      location: " Perthshire ",
      budget: "2500",
      sort: "price-desc",
      page: "-4",
    })).toEqual({
      search: "Highland films",
      venue: "venue-id",
      location: "Perthshire",
      budgetPence: 250_000,
      sort: "price-desc",
      page: 1,
    });
    expect(PLANNING_HUB_SUPPLIER_PAGE_SIZE).toBe(8);
  });

  it("falls back to a stable default for invalid sort and excessive numbers", () => {
    expect(normalisePlanningHubSupplierSearchParams({
      budget: "999999999",
      page: "999999",
      sort: "invalid" as "name",
    })).toMatchObject({
      budgetPence: 1_000_000_000,
      page: 1_000,
      sort: "price-asc",
    });
  });

  it("recognises mapped categories without exposing disabled stages as live", () => {
    expect(getPlanningHubSupplierCategory("videographer")).toMatchObject({
      budgetCategoryId: "videography",
      live: false,
    });
    expect(getLivePlanningHubSupplierCategory("photographer")?.live).toBe(true);
    expect(getLivePlanningHubSupplierCategory("videographer")).toBeNull();
    expect(isSupplierCategorySlug("florist")).toBe(true);
    expect(isSupplierCategorySlug("unknown")).toBe(false);
  });
});
