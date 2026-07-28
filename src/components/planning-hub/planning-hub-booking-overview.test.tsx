import { fireEvent, render, screen, within } from "@testing-library/react";
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
    availabilityStatus: "available",
    availabilityDate: "2027-06-12",
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
    plan.weddingDate = "2027-06-12";
    plan.selectedVenueId = "venue-1";
    plan.items = [venue()];

    render(
      <PlanningHubBookingOverview
        plan={plan}
        workspaceId="60000000-0000-4000-8000-000000000006"
      />,
    );

    expect(screen.getByText("Selected venue")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Date readiness" })).toBeTruthy();
    expect(screen.getByText("Availability is tracked against your current wedding date.")).toBeTruthy();
    expect(screen.getByText("1 available")).toBeTruthy();
    expect(screen.getByText("Available for your date")).toBeTruthy();
    expect(screen.getByText("£1,000 paid · £4,000 left")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review booking stage" }).getAttribute("href"))
      .toBe("/planning-hub?planItem=venue-1&workspace=60000000-0000-4000-8000-000000000006#current-venue-planning");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
  });

  it("explains that availability checks need a wedding date", () => {
    const plan = createEmptyBudgetPlan();
    plan.items = [venue()];

    render(<PlanningHubBookingOverview plan={plan} />);

    expect(screen.getByText(
      "Set your wedding date to start checking each venue and supplier.",
    )).toBeTruthy();
    expect(screen.getByText("1 need action")).toBeTruthy();
    expect(screen.getByText("Set wedding date")).toBeTruthy();
  });

  it("batches a long booking list without making later items unreachable", () => {
    const plan = createEmptyBudgetPlan();
    plan.weddingDate = "2027-06-12";
    plan.items = Array.from({ length: 14 }, (_, index) => {
      const itemNumber = String(index + 1).padStart(2, "0");
      return {
        ...venue(),
        id: `venue-${itemNumber}`,
        listingId: `venue-${itemNumber}`,
        itemName: `Venue ${itemNumber}`,
        supplierName: `Venue ${itemNumber}`,
      };
    });

    render(<PlanningHubBookingOverview plan={plan} />);

    const pipeline = screen.getByRole("list", { name: "Booking pipeline" });
    expect(within(pipeline).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.queryByText("Venue 14")).toBeNull();

    const showMore = screen.getByRole("button", {
      name: "Show 6 more bookings",
    });
    expect(showMore.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(showMore);

    expect(within(pipeline).getAllByRole("listitem")).toHaveLength(12);
    expect(screen.queryByText("Venue 14")).toBeNull();
    expect(screen.getByRole("button", { name: "Show 2 more bookings" }))
      .toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show 2 more bookings" }));

    expect(within(pipeline).getAllByRole("listitem")).toHaveLength(14);
    expect(screen.getByText("Venue 14")).toBeTruthy();
    expect(screen.getAllByText("Available for your date")).toHaveLength(14);
    expect(screen.getAllByRole("link", { name: "Review booking stage" }))
      .toHaveLength(14);

    const showFewer = screen.getByRole("button", {
      name: "Show fewer bookings",
    });
    expect(showFewer.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(showFewer);

    expect(within(pipeline).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.queryByText("Venue 14")).toBeNull();
  });
});
