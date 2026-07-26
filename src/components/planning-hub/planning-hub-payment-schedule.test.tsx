import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { plannerListingToBudgetItem } from "@/lib/budget/listing-pricing";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import type { BudgetItem, BudgetPlan } from "@/lib/budget/types";
import { PlanningHubDeadlineSummary, PlanningHubPaymentSchedule } from "./planning-hub-payment-schedule";

function budgetItem(): BudgetItem {
  return plannerListingToBudgetItem({
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
  }, createEmptyBudgetPlan());
}

describe("PlanningHubPaymentSchedule", () => {
  it("adds and saves an accessible instalment row", () => {
    const onSave = vi.fn();
    render(<PlanningHubPaymentSchedule currency="GBP" item={budgetItem()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Add payment" }));
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Booking deposit" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Paid so far"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-08-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payment schedule" }));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "deposit",
        label: "Booking deposit",
        amountPence: 100_000,
        paidPence: 50_000,
        dueDate: "2026-08-01",
      }),
    ]);
  });

  it("keeps separately added payment rows independently editable", () => {
    const onSave = vi.fn();
    render(<PlanningHubPaymentSchedule currency="GBP" item={budgetItem()} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Add payment" }));
    fireEvent.click(screen.getByRole("button", { name: "Add payment" }));
    const labels = screen.getAllByLabelText("Label");
    fireEvent.change(labels[0], { target: { value: "Deposit" } });
    fireEvent.change(labels[1], { target: { value: "Final balance" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payment schedule" }));

    const saved = onSave.mock.calls[0][0] as BudgetItem["installments"];
    expect(saved.map((installment) => installment.label)).toEqual(["Deposit", "Final balance"]);
    expect(new Set(saved.map((installment) => installment.id)).size).toBe(2);
  });

  it("summarises overdue deadlines across the connected plan", () => {
    const item = {
      ...budgetItem(),
      installments: [{
        id: "final",
        kind: "final" as const,
        label: "Final balance",
        amountPence: 400_000,
        paidPence: 0,
        dueDate: "2026-07-01",
        paidAt: null,
      }],
    };
    const plan: BudgetPlan = { ...createEmptyBudgetPlan(), items: [item] };
    render(<PlanningHubDeadlineSummary plan={plan} today="2026-07-26" />);
    expect(screen.getByText("Next payment deadlines")).toBeTruthy();
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getByText("Final balance · 1 Jul 2026")).toBeTruthy();
  });
});
