import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import type { BudgetItem } from "@/lib/budget/types";
import { PlanningHubBookingOverview } from "./planning-hub-booking-overview";

function venue(): BudgetItem {
  return {
    id: "venue-1",
    categoryId: "venue",
    listingId: "venue-1",
    listingType: null,
    listingUrl: null,
    imageUrl: null,
    source: "website",
    itemName: "Venue One",
    supplierName: "Venue One",
    supplierType: "Venue",
    description: null,
    estimatedCostPence: null,
    confirmedCostPence: 500_000,
    importedPricePence: null,
    importedPriceToPence: null,
    importedPriceType: null,
    costPerPersonPence: null,
    guestCount: null,
    depositPaidPence: 100_000,
    totalPaidPence: 100_000,
    installments: [],
    costStatus: "partially_paid",
    paymentStatus: "partially_paid",
    bookingStatus: "booked",
    dueDate: null,
    websiteUrl: null,
    notes: null,
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
    sortOrder: 0,
  };
}

describe("PlanningHubBookingOverview", () => {
  it("offers connected discovery from an honest empty state", () => {
    render(
      <PlanningHubBookingOverview
        plan={createEmptyBudgetPlan()}
        workspaceId="60000000-0000-4000-8000-000000000006"
      />,
    );

    expect(screen.getByRole("heading", { name: "Budget & bookings" })).toBeTruthy();
    expect(screen.getByText("No bookings or shortlist items yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Find a venue" }).getAttribute("href"))
      .toBe("/planning-hub?workspace=60000000-0000-4000-8000-000000000006");
  });

  it("shows committed, paid and remaining figures with an actionable booking", () => {
    const plan = createEmptyBudgetPlan();
    plan.totalBudgetPence = 2_000_000;
    plan.selectedVenueId = "venue-1";
    plan.items = [venue()];

    render(
      <PlanningHubBookingOverview
        plan={plan}
        workspaceId="60000000-0000-4000-8000-000000000006"
      />,
    );

    expect(screen.getByText("Selected venue")).toBeTruthy();
    expect(screen.getByText("£1,000 paid · £4,000 left")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review booking stage" }).getAttribute("href"))
      .toBe("/planning-hub?planItem=venue-1&workspace=60000000-0000-4000-8000-000000000006#current-venue-planning");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
  });
});
