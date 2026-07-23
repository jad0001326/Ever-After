import { describe, expect, it } from "vitest";
import type { PlanningHubVenue } from "./types";
import {
  addManualPlanningHubVenue,
  calculatePlanningHubPlan,
  choosePlanningHubVenue,
  createPlanningHubStarterPlan,
  getPhotographyNextHref,
  updatePlanningHubVenuePayment,
  upsertPlanningHubVenue
} from "./plan";

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
  hasApprovedPhoto: false
};

describe("Planning Hub plan", () => {
  it("keeps shortlist and selected venue as separate states", () => {
    const shortlisted = upsertPlanningHubVenue(createPlanningHubStarterPlan("user-1"), venue, 650_000, "shortlisted");
    expect(shortlisted.selectedVenueId).toBeNull();
    expect(shortlisted.items[0].bookingStatus).toBe("shortlisted");

    const selected = choosePlanningHubVenue(shortlisted, venue.id);
    expect(selected.selectedVenueId).toBe(venue.id);
  });

  it("moves a quoted venue into committed spend only when booked", () => {
    const quoted = upsertPlanningHubVenue(createPlanningHubStarterPlan("user-1"), venue, 700_000, "quoted");
    expect(calculatePlanningHubPlan(quoted).committedPence).toBe(0);

    const booked = upsertPlanningHubVenue(quoted, venue, 700_000, "booked");
    expect(calculatePlanningHubPlan(booked)).toMatchObject({
      plannedPence: 700_000,
      committedPence: 700_000,
      remainingPence: 1_300_000,
      outstandingCommittedPence: 700_000
    });
  });

  it("supports a manual venue and a contextual photography handoff", () => {
    const plan = addManualPlanningHubVenue(createPlanningHubStarterPlan(null), "Our local hall", 300_000, "booked");
    const contextual = { ...plan, selectedVenueId: venue.id, location: "Perthshire" };

    expect(plan.items[0]).toMatchObject({ source: "manual", itemName: "Our local hall", bookingStatus: "booked" });
    expect(getPhotographyNextHref(contextual)).toContain("venue=venue-1");
    expect(getPhotographyNextHref(contextual)).toContain("location=Perthshire");
  });

  it("derives partial and paid states from deposits and instalments", () => {
    const booked = upsertPlanningHubVenue(createPlanningHubStarterPlan("user-1"), venue, 700_000, "booked");
    const partial = updatePlanningHubVenuePayment(booked, venue.id, 100_000, 250_000, "2027-03-01");
    expect(partial.items[0]).toMatchObject({
      depositPaidPence: 100_000,
      totalPaidPence: 250_000,
      paymentStatus: "partially_paid",
      costStatus: "partially_paid",
      dueDate: "2027-03-01"
    });
    expect(calculatePlanningHubPlan(partial).outstandingCommittedPence).toBe(450_000);

    const paid = updatePlanningHubVenuePayment(partial, venue.id, 100_000, 700_000, null);
    expect(paid.items[0]).toMatchObject({ paymentStatus: "paid", costStatus: "paid" });
    expect(calculatePlanningHubPlan(paid).outstandingCommittedPence).toBe(0);
  });
});
