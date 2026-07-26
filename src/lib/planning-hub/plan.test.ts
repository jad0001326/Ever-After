import { describe, expect, it } from "vitest";
import type { PlanningHubPhotographer, PlanningHubVenue } from "./types";
import {
  addManualPlanningHubPhotographer,
  addManualPlanningHubVenue,
  calculatePlanningHubPlan,
  choosePlanningHubVenue,
  createPlanningHubStarterPlan,
  findPlanningHubPhotographyItem,
  findPlanningHubVenueItem,
  getPhotographyNextHref,
  updatePlanningHubItemInstallments,
  updatePlanningHubPhotographerPayment,
  updatePlanningHubVenuePayment,
  upsertPlanningHubPhotographer,
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

const photographer: PlanningHubPhotographer = {
  id: "photographer-1",
  slug: "photographer-one",
  name: "Photographer One",
  baseTown: "Perth",
  region: "Perthshire",
  summary: "Natural wedding photography.",
  styles: ["Documentary"],
  heroImageUrl: "/everaft-logo-mark.svg",
  hasApprovedPhoto: false,
  startingPricePence: null,
  typicalPricePence: null,
  pricingSummary: "Quote required",
  pricingUnit: "quote",
  isClaimed: true,
  travelsNationwide: true
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
    expect(findPlanningHubVenueItem(plan, plan.items[0].id)).toBe(plan.items[0]);
    expect(getPhotographyNextHref(contextual)).toContain("/planning-hub/photography?");
    expect(getPhotographyNextHref(contextual)).toContain("venue=venue-1");
    expect(getPhotographyNextHref(contextual)).toContain("location=Perthshire");
  });

  it("adds quote-only photography to the same connected budget and tracks payment", () => {
    const plan = createPlanningHubStarterPlan("user-1");
    const quoted = upsertPlanningHubPhotographer(plan, photographer, 180_000, "quoted");

    expect(quoted.items[0]).toMatchObject({
      categoryId: "photography",
      listingId: "photographer-1",
      confirmedCostPence: 180_000,
      bookingStatus: "quoted"
    });
    expect(calculatePlanningHubPlan(quoted)).toMatchObject({
      plannedPence: 180_000,
      committedPence: 0,
      remainingPence: 1_820_000
    });

    const booked = upsertPlanningHubPhotographer(quoted, photographer, 180_000, "booked");
    const paid = updatePlanningHubPhotographerPayment(booked, photographer.id, 30_000, 30_000, "2027-02-01");
    expect(paid.items[0]).toMatchObject({
      bookingStatus: "booked",
      paymentStatus: "partially_paid",
      costStatus: "partially_paid",
      dueDate: "2027-02-01"
    });
    expect(calculatePlanningHubPlan(paid).outstandingCommittedPence).toBe(150_000);
  });

  it("keeps manual photography available when no listing is suitable", () => {
    const plan = addManualPlanningHubPhotographer(createPlanningHubStarterPlan(null), "A family friend", 50_000, "shortlisted");
    expect(plan.items[0]).toMatchObject({
      categoryId: "photography",
      source: "manual",
      supplierType: "Photographer",
      itemName: "A family friend"
    });
    expect(findPlanningHubPhotographyItem(plan, plan.items[0].id)).toBe(plan.items[0]);
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

  it("derives aggregate totals and the next deadline from a payment schedule", () => {
    const booked = upsertPlanningHubVenue(createPlanningHubStarterPlan(null), venue, 700_000, "booked");
    const updated = updatePlanningHubItemInstallments(booked, booked.items[0].id, [
      { id: "deposit", kind: "deposit", label: "Deposit", amountPence: 100_000, paidPence: 100_000, dueDate: "2026-08-01", paidAt: "2026-07-20" },
      { id: "middle", kind: "installment", label: "Second payment", amountPence: 250_000, paidPence: 50_000, dueDate: "2026-10-01", paidAt: null },
      { id: "final", kind: "final", label: "Final balance", amountPence: 350_000, paidPence: 0, dueDate: "2027-03-01", paidAt: null },
    ]);

    expect(updated.items[0]).toMatchObject({
      depositPaidPence: 100_000,
      totalPaidPence: 150_000,
      dueDate: "2026-10-01",
      paymentStatus: "partially_paid",
      costStatus: "partially_paid",
    });
  });
});
