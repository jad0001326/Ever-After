import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { plannerListingToBudgetItem } from "@/lib/budget/listing-pricing";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import { PlanningHubPaymentOverview } from "./planning-hub-payment-overview";

describe("PlanningHubPaymentOverview", () => {
  it("gives an honest empty state before deadlines are scheduled", () => {
    render(
      <PlanningHubPaymentOverview
        plan={createEmptyBudgetPlan()}
        today="2026-07-28"
      />,
    );

    expect(screen.getByRole("heading", { name: "Payments & deadlines" })).toBeTruthy();
    expect(screen.getByText("No payment deadlines scheduled yet.")).toBeTruthy();
    expect(screen.getByText("No overdue payments")).toBeTruthy();
  });

  it("surfaces overdue and due-soon payments with an actionable stage link", () => {
    const plan = createEmptyBudgetPlan();
    const venue = plannerListingToBudgetItem({
      id: "venue-1",
      slug: "venue-one",
      name: "Venue One",
      type: "Venue",
      categoryId: "venue",
      location: "Fife",
      imageUrl: "/venue.jpg",
      listingUrl: "/venues/venue-one",
      priceFromPence: 500_000,
      priceToPence: null,
      pricingStatus: "fixed",
    }, plan);
    venue.installments = [{
      id: "final",
      kind: "final",
      label: "Final balance",
      amountPence: 400_000,
      paidPence: 0,
      dueDate: "2026-07-01",
      paidAt: null,
    }];
    plan.items = [venue];

    render(
      <PlanningHubPaymentOverview
        plan={plan}
        today="2026-07-28"
        workspaceId="60000000-0000-4000-8000-000000000006"
      />,
    );

    expect(screen.getAllByText("1 overdue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("£4,000").length).toBe(2);
    expect(screen.getByText("Final balance · 1 Jul 2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review payment plan" }).getAttribute("href"))
      .toBe("/planning-hub?workspace=60000000-0000-4000-8000-000000000006#payment-deadlines-title");
  });
});
