import { describe, expect, it } from "vitest";
import type { PlanningHubPhotographer, PlanningHubSupplier, PlanningHubVenue } from "./types";
import {
  addManualPlanningHubSupplier,
  addManualPlanningHubPhotographer,
  addManualPlanningHubVenue,
  calculatePlanningHubPlan,
  choosePlanningHubVenue,
  createPlanningHubStarterPlan,
  findPlanningHubPhotographyItem,
  findPlanningHubSupplierItem,
  findPlanningHubVenueItem,
  getPhotographyNextHref,
  getPlanningHubItemAvailability,
  removePlanningHubItem,
  updatePlanningHubItemAvailability,
  updatePlanningHubItemInstallments,
  updatePlanningHubPhotographerPayment,
  updatePlanningHubVenuePayment,
  upsertPlanningHubSupplier,
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

const videographer: PlanningHubSupplier = {
  id: "videographer-1",
  categorySlug: "videographer",
  slug: "videographer-one",
  name: "Videographer One",
  baseTown: "Glasgow",
  region: "Strathclyde",
  summary: "Wedding films.",
  heroImageUrl: "/everaft-logo-mark.svg",
  hasApprovedPhoto: false,
  startingPricePence: 180_000,
  typicalPricePence: 240_000,
  pricingSummary: "Full-day films",
  pricingUnit: "package",
  isClaimed: false,
  travelsNationwide: true,
};

describe("Planning Hub plan", () => {
  it("keeps shortlist and selected venue as separate states", () => {
    const shortlisted = upsertPlanningHubVenue(createPlanningHubStarterPlan("user-1"), venue, 650_000, "shortlisted");
    expect(shortlisted.selectedVenueId).toBeNull();
    expect(shortlisted.items[0].bookingStatus).toBe("shortlisted");

    const selected = choosePlanningHubVenue(shortlisted, venue.id);
    expect(selected.selectedVenueId).toBe(venue.id);
  });

  it("removes a selected venue from active planning without losing its history", () => {
    const booked = upsertPlanningHubVenue(
      createPlanningHubStarterPlan("user-1"),
      venue,
      700_000,
      "booked",
    );
    const withPayments = updatePlanningHubItemInstallments(
      choosePlanningHubVenue(booked, venue.id),
      booked.items[0].id,
      [{
        id: "deposit",
        kind: "deposit",
        label: "Deposit",
        amountPence: 100_000,
        paidPence: 100_000,
        dueDate: "2026-08-01",
        paidAt: "2026-07-20",
      }],
    );
    const removed = removePlanningHubItem(withPayments, withPayments.items[0].id);

    expect(removed.selectedVenueId).toBeNull();
    expect(removed.items[0]).toMatchObject({
      bookingStatus: "cancelled",
      costStatus: "cancelled",
      totalPaidPence: 100_000,
      installments: [{ id: "deposit" }],
    });
    expect(findPlanningHubVenueItem(removed, venue.id)).toBeNull();
    expect(calculatePlanningHubPlan(removed)).toMatchObject({
      plannedPence: 0,
      committedPence: 0,
      paidPence: 0,
      remainingPence: 2_000_000,
      activeItemCount: 0,
    });
  });

  it("removes a supplier without clearing an unrelated selected venue and can reactivate it", () => {
    const withVenue = choosePlanningHubVenue(
      upsertPlanningHubVenue(createPlanningHubStarterPlan(null), venue, 650_000, "shortlisted"),
      venue.id,
    );
    const withSupplier = upsertPlanningHubSupplier(
      withVenue,
      videographer,
      210_000,
      "quoted",
    );
    const removed = removePlanningHubItem(withSupplier, withSupplier.items[1].id);

    expect(removed.selectedVenueId).toBe(venue.id);
    expect(findPlanningHubSupplierItem(removed, "videographer", videographer.id)).toBeNull();

    const reactivated = upsertPlanningHubSupplier(
      removed,
      videographer,
      220_000,
      "shortlisted",
    );
    expect(reactivated.items).toHaveLength(2);
    expect(findPlanningHubSupplierItem(reactivated, "videographer", videographer.id))
      .toMatchObject({
        id: withSupplier.items[1].id,
        bookingStatus: "shortlisted",
        costStatus: "estimated",
        estimatedCostPence: 220_000,
      });
  });

  it("does not rewrite a plan when the item is absent or already removed", () => {
    const plan = upsertPlanningHubVenue(
      createPlanningHubStarterPlan(null),
      venue,
      650_000,
      "shortlisted",
    );
    const removed = removePlanningHubItem(plan, plan.items[0].id);

    expect(removePlanningHubItem(plan, "missing-item")).toBe(plan);
    expect(removePlanningHubItem(removed, removed.items[0].id)).toBe(removed);
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
    const contextual = {
      ...choosePlanningHubVenue(plan, plan.items[0].id),
      location: "Perthshire",
      weddingDate: "2027-06-12",
    };
    const cataloguePlan = choosePlanningHubVenue(
      upsertPlanningHubVenue(createPlanningHubStarterPlan(null), venue, 650_000, "booked"),
      venue.id,
    );

    expect(plan.items[0]).toMatchObject({ source: "manual", itemName: "Our local hall", bookingStatus: "booked" });
    expect(findPlanningHubVenueItem(plan, plan.items[0].id)).toBe(plan.items[0]);
    expect(getPhotographyNextHref(contextual)).toContain("/planning-hub/photography?");
    expect(getPhotographyNextHref(contextual)).toContain("context=plan");
    expect(getPhotographyNextHref(contextual)).toContain("remainingPence=1700000");
    expect(getPhotographyNextHref(contextual)).not.toContain("venue=");
    expect(getPhotographyNextHref(contextual)).toContain("venueName=Our+local+hall");
    expect(getPhotographyNextHref(contextual)).toContain("planDate=2027-06-12");
    const connectedHref = getPhotographyNextHref(
      contextual,
      "Documentary",
      "60000000-0000-4000-8000-000000000006",
    );
    expect(connectedHref).toContain("workspace=60000000-0000-4000-8000-000000000006");
    expect(connectedHref).not.toContain("context=plan");
    expect(connectedHref).not.toContain("budget=");
    expect(getPhotographyNextHref(cataloguePlan)).toContain("venue=venue-1");
    expect(getPhotographyNextHref(contextual)).toContain("planLocation=Perthshire");

    const overBudget = {
      ...contextual,
      totalBudgetPence: 100_000,
    };
    expect(getPhotographyNextHref(overBudget)).toContain("remainingPence=-200000");
    expect(getPhotographyNextHref(overBudget)).not.toContain("budget=");
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

  it("maps any known supplier category into the connected budget model", () => {
    const plan = upsertPlanningHubSupplier(
      createPlanningHubStarterPlan(null),
      videographer,
      210_000,
      "quoted",
    );

    expect(plan.items[0]).toMatchObject({
      categoryId: "videography",
      listingId: "videographer-1",
      listingType: "Videographer",
      listingUrl: "/suppliers/videographer/videographer-one",
      confirmedCostPence: 210_000,
      importedPricePence: 180_000,
      importedPriceToPence: 240_000,
      importedPriceType: "range",
      bookingStatus: "quoted",
    });
    expect(findPlanningHubSupplierItem(plan, "videographer", videographer.id)).toBe(plan.items[0]);
  });

  it("keeps manual entry category-neutral for future supplier stages", () => {
    const plan = addManualPlanningHubSupplier(
      createPlanningHubStarterPlan(null),
      "florist",
      "A local florist",
      90_000,
      "shortlisted",
    );

    expect(plan.items[0]).toMatchObject({
      categoryId: "flowers",
      source: "manual",
      supplierType: "Florist",
      itemName: "A local florist",
      estimatedCostPence: 90_000,
    });
    expect(findPlanningHubSupplierItem(plan, "florist", plan.items[0].id)).toBe(plan.items[0]);
  });

  it("distinguishes supplier types that share one budget category", () => {
    const withBand = addManualPlanningHubSupplier(
      createPlanningHubStarterPlan(null),
      "band-musician",
      "The Ceilidh Band",
      140_000,
      "shortlisted",
    );
    const withDj = addManualPlanningHubSupplier(
      withBand,
      "dj",
      "Evening DJ",
      80_000,
      "shortlisted",
    );

    expect(withDj.items.map((item) => item.categoryId)).toEqual(["dj-band", "dj-band"]);
    expect(findPlanningHubSupplierItem(withDj, "band-musician", withBand.items[0].id)?.itemName)
      .toBe("The Ceilidh Band");
    expect(findPlanningHubSupplierItem(withDj, "dj", withDj.items[1].id)?.itemName)
      .toBe("Evening DJ");
    expect(findPlanningHubSupplierItem(withDj, "dj", withBand.items[0].id)).toBeNull();
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

  it("tracks supplier availability against the current wedding date", () => {
    const initial = {
      ...createPlanningHubStarterPlan(null),
      weddingDate: "2027-06-12",
    };
    const shortlisted = upsertPlanningHubPhotographer(
      initial,
      photographer,
      200_000,
      "shortlisted",
    );
    const enquired = updatePlanningHubItemAvailability(
      shortlisted,
      shortlisted.items[0].id,
      "enquiry_sent",
    );

    expect(enquired.items[0]).toMatchObject({
      availabilityStatus: "enquiry_sent",
      availabilityDate: "2027-06-12",
    });
    expect(getPlanningHubItemAvailability(
      enquired.items[0],
      "2027-06-19",
    )).toEqual({
      status: "enquiry_sent",
      checkedDate: "2027-06-12",
      stale: true,
    });
  });

  it("records a booked item as available only for the plan's current date", () => {
    const plan = upsertPlanningHubVenue(
      {
        ...createPlanningHubStarterPlan(null),
        weddingDate: "2027-06-12",
      },
      venue,
      700_000,
      "booked",
    );

    expect(plan.items[0]).toMatchObject({
      availabilityStatus: "available",
      availabilityDate: "2027-06-12",
    });

    const undated = upsertPlanningHubVenue(
      createPlanningHubStarterPlan(null),
      venue,
      700_000,
      "booked",
    );
    expect(undated.items[0]).toMatchObject({
      availabilityStatus: "not_checked",
      availabilityDate: null,
    });
  });
});
