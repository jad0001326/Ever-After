import { describe, expect, it } from "vitest";
import {
  addManualPlanningHubVenue,
  choosePlanningHubVenue,
  createPlanningHubStarterPlan,
  upsertPlanningHubVenue,
} from "./plan";
import type { PlanningHubVenue } from "./types";
import {
  getLivePlanningHubSupplierCategory,
  getPlanningHubSupplierCategory,
  getPlanningHubSupplierDiscoveryContext,
  getPlanningHubSupplierResetHref,
  isSupplierCategorySlug,
  normalisePlanningHubSupplierSearchParams,
  PLANNING_HUB_SUPPLIER_PAGE_SIZE,
} from "./supplier-search";

const venue: PlanningHubVenue = {
  id: "venue-1",
  slug: "venue-one",
  name: "Venue One",
  type: "Castle",
  town: "Perth",
  region: "Perthshire",
  summary: "A venue.",
  capacityMax: 120,
  imageUrl: "/images/everaft-wedding-reception.png",
  priceFromPence: 650_000,
  pricingLabel: "Venue hire",
  pricingUnit: "total",
  hasApprovedPhoto: false,
};

describe("Planning Hub supplier search", () => {
  it("derives catalogue venue, profile location and remaining budget from the connected plan", () => {
    const planned = upsertPlanningHubVenue(
      {
        ...createPlanningHubStarterPlan(null),
        location: "Perthshire",
      },
      venue,
      650_000,
      "shortlisted",
    );
    const context = getPlanningHubSupplierDiscoveryContext(
      choosePlanningHubVenue(planned, venue.id),
      { style: "Documentary" },
    );

    expect(context).toEqual({
      derivedFilters: {
        budget: true,
        location: true,
        venue: true,
      },
      effectiveParams: {
        budget: "13500",
        location: "Perthshire",
        style: "Documentary",
        venue: "venue-1",
      },
      navigationParams: {
        style: "Documentary",
      },
      remainingPence: 1_350_000,
      selectedVenueName: "Venue One",
      weddingDate: null,
    });
  });

  it("keeps a manual selected venue visible without sending its plan-item id to the catalogue", () => {
    const planned = addManualPlanningHubVenue(
      {
        ...createPlanningHubStarterPlan(null),
        location: "Fife",
      },
      "Our village hall",
      300_000,
      "booked",
    );
    const context = getPlanningHubSupplierDiscoveryContext(
      choosePlanningHubVenue(planned, planned.items[0].id),
      {},
    );

    expect(context.effectiveParams).toMatchObject({
      budget: "17000",
      location: "Fife",
    });
    expect(context.effectiveParams.venue).toBeUndefined();
    expect(context.navigationParams).toEqual({});
    expect(context.derivedFilters.venue).toBe(false);
    expect(context.selectedVenueName).toBe("Our village hall");
    expect(context.weddingDate).toBeNull();
  });

  it("preserves explicit supplier filters over connected-plan defaults", () => {
    const plan = {
      ...createPlanningHubStarterPlan(null),
      location: "Perthshire",
    };
    const context = getPlanningHubSupplierDiscoveryContext(plan, {
      budget: "900",
      location: "Skye",
      venue: "another-venue",
    });

    expect(context.effectiveParams).toMatchObject({
      budget: "900",
      location: "Skye",
      venue: "another-venue",
    });
    expect(context.derivedFilters).toEqual({
      budget: false,
      location: false,
      venue: false,
    });
  });

  it("retains transported device-plan values as derived context", () => {
    const context = getPlanningHubSupplierDiscoveryContext(
      createPlanningHubStarterPlan(null),
      {
        context: "plan",
        planDate: "2027-06-12",
        planLocation: "Fife",
        remainingPence: "1700000",
        venue: "catalogue-venue",
        venueName: "Venue One",
      },
    );

    expect(context.effectiveParams).toMatchObject({
      budget: "17000",
      context: "plan",
      location: "Fife",
      planDate: "2027-06-12",
      planLocation: "Fife",
      remainingPence: "1700000",
      venue: "catalogue-venue",
      venueName: "Venue One",
    });
    expect(context.derivedFilters).toEqual({
      budget: true,
      location: true,
      venue: true,
    });
    expect(context.selectedVenueName).toBe("Venue One");
    expect(context.remainingPence).toBe(1_700_000);
    expect(context.weddingDate).toBe("2027-06-12");
    expect(getPlanningHubSupplierResetHref(
      "/planning-hub/photography",
      {
        ...context.effectiveParams,
        budget: "900",
        location: "Skye",
        search: "Studio",
      },
    )).toBe(
      "/planning-hub/photography?context=plan"
      + "&planDate=2027-06-12"
      + "&planLocation=Fife"
      + "&remainingPence=1700000"
      + "&venue=catalogue-venue"
      + "&venueName=Venue+One",
    );

    const emptyTransport = getPlanningHubSupplierDiscoveryContext(
      createPlanningHubStarterPlan(null),
      { context: "plan" },
    );
    expect(emptyTransport.effectiveParams).toEqual({ context: "plan" });
    expect(emptyTransport.derivedFilters).toEqual({
      budget: false,
      location: false,
      venue: false,
    });
    expect(emptyTransport.remainingPence).toBe(0);
  });

  it("does not invent a budget filter when the plan has no remaining money", () => {
    const plan = upsertPlanningHubVenue(
      {
        ...createPlanningHubStarterPlan(null),
        totalBudgetPence: 100_000,
      },
      venue,
      650_000,
      "booked",
    );
    const context = getPlanningHubSupplierDiscoveryContext(plan, {});

    expect(context.remainingPence).toBe(-550_000);
    expect(context.effectiveParams.budget).toBeUndefined();
    expect(context.derivedFilters.budget).toBe(false);

    const transported = getPlanningHubSupplierDiscoveryContext(
      createPlanningHubStarterPlan(null),
      {
        context: "plan",
        remainingPence: "-550000",
      },
    );
    expect(transported.remainingPence).toBe(-550_000);
    expect(transported.effectiveParams.budget).toBeUndefined();
    expect(transported.derivedFilters.budget).toBe(false);
  });

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
