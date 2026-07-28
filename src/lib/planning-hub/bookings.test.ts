import { describe, expect, it } from "vitest";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import type { BookingStatus, BudgetItem } from "@/lib/budget/types";
import {
  getPlanningHubAvailabilityLabel,
  getPlanningHubBookingOverview,
  getPlanningHubBookingStatusLabel,
} from "./bookings";

function item(
  id: string,
  categoryId: string,
  bookingStatus: BookingStatus,
  costPence: number | null,
  overrides: Partial<BudgetItem> = {},
): BudgetItem {
  return {
    id,
    categoryId,
    listingId: id,
    listingType: null,
    listingUrl: null,
    imageUrl: null,
    source: "website",
    itemName: id,
    supplierName: id,
    supplierType: categoryId === "venue" ? "Venue" : "Photographer",
    description: null,
    estimatedCostPence: bookingStatus === "booked" || bookingStatus === "quoted" ? null : costPence,
    confirmedCostPence: bookingStatus === "booked" || bookingStatus === "quoted" ? costPence : null,
    importedPricePence: null,
    importedPriceToPence: null,
    importedPriceType: null,
    costPerPersonPence: null,
    guestCount: null,
    depositPaidPence: 0,
    totalPaidPence: 0,
    installments: [],
    costStatus: bookingStatus === "booked" ? "booked" : bookingStatus === "quoted" ? "quoted" : "estimated",
    paymentStatus: "not_started",
    bookingStatus,
    availabilityStatus: bookingStatus === "booked" ? "available" : "not_checked",
    availabilityDate: bookingStatus === "booked" ? "2027-06-12" : null,
    dueDate: null,
    websiteUrl: null,
    notes: null,
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
    sortOrder: 0,
    ...overrides,
  };
}

describe("Planning Hub booking overview", () => {
  it("summarises active commitments and orders booked work first", () => {
    const plan = createEmptyBudgetPlan();
    plan.totalBudgetPence = 2_000_000;
    plan.weddingDate = "2027-06-12";
    plan.selectedVenueId = "venue-one";
    plan.items = [
      item("researching", "photography", "researching", null),
      item("quoted", "photography", "quoted", 200_000),
      item("venue-one", "venue", "booked", 500_000, {
        totalPaidPence: 100_000,
        paymentStatus: "partially_paid",
      }),
      item("cancelled", "venue", "cancelled", 900_000, {
        costStatus: "cancelled",
      }),
    ];

    const overview = getPlanningHubBookingOverview(
      plan,
      "60000000-0000-4000-8000-000000000006",
    );

    expect(overview).toMatchObject({
      bookedCount: 1,
      quotedCount: 1,
      shortlistedCount: 0,
      researchingCount: 1,
      availabilityAvailableCount: 1,
      availabilityAwaitingCount: 0,
      availabilityNeedsActionCount: 2,
      availabilityUnavailableCount: 0,
      budget: {
        plannedPence: 700_000,
        committedPence: 500_000,
        paidPence: 100_000,
        remainingPence: 1_300_000,
        missingPriceCount: 1,
      },
    });
    expect(overview.items.map((entry) => entry.itemId))
      .toEqual(["venue-one", "quoted", "researching"]);
    expect(overview.items[0]).toMatchObject({
      costPence: 500_000,
      paidPence: 100_000,
      outstandingPence: 400_000,
      selectedVenue: true,
      availabilityState: "available",
      stageHref: "/planning-hub?planItem=venue-one&workspace=60000000-0000-4000-8000-000000000006#current-venue-planning",
    });
  });

  it("separates current, awaiting, unavailable and stale availability", () => {
    const plan = createEmptyBudgetPlan();
    plan.weddingDate = "2027-06-12";
    plan.items = [
      item("available", "venue", "shortlisted", 400_000, {
        availabilityStatus: "available",
        availabilityDate: "2027-06-12",
      }),
      item("awaiting", "photography", "quoted", 200_000, {
        availabilityStatus: "enquiry_sent",
        availabilityDate: "2027-06-12",
      }),
      item("unavailable", "photography", "researching", null, {
        availabilityStatus: "unavailable",
        availabilityDate: "2027-06-12",
      }),
      item("stale", "photography", "shortlisted", 150_000, {
        availabilityStatus: "available",
        availabilityDate: "2027-05-29",
      }),
      item("unchecked", "photography", "researching", null),
    ];

    const overview = getPlanningHubBookingOverview(plan);

    expect(overview).toMatchObject({
      availabilityAvailableCount: 1,
      availabilityAwaitingCount: 1,
      availabilityNeedsActionCount: 2,
      availabilityUnavailableCount: 1,
    });
    expect(Object.fromEntries(
      overview.items.map((entry) => [entry.itemId, entry.availabilityState]),
    )).toEqual({
      awaiting: "enquiry_sent",
      available: "available",
      stale: "stale",
      unavailable: "unavailable",
      unchecked: "not_checked",
    });
  });

  it("requires a wedding date before treating saved availability as current", () => {
    const plan = createEmptyBudgetPlan();
    plan.items = [item("venue", "venue", "booked", 500_000)];

    const overview = getPlanningHubBookingOverview(plan);

    expect(overview.availabilityAvailableCount).toBe(0);
    expect(overview.availabilityNeedsActionCount).toBe(1);
    expect(overview.items[0].availabilityState).toBe("date_needed");
  });

  it("provides consistent user-facing booking labels", () => {
    expect(getPlanningHubBookingStatusLabel("quoted")).toBe("Quote received");
    expect(getPlanningHubBookingStatusLabel("researching")).toBe("Researching");
    expect(getPlanningHubAvailabilityLabel("stale"))
      .toBe("Availability needs rechecking");
    expect(getPlanningHubAvailabilityLabel("date_needed"))
      .toBe("Set wedding date");
  });
});
