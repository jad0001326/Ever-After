import { describe, expect, it } from "vitest";
import { plannerListingToBudgetItem } from "@/lib/budget/listing-pricing";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import type { BudgetPlan } from "@/lib/budget/types";
import {
  getPlanningHubPaymentDeadlineHref,
  getPlanningHubPaymentOverview,
} from "./payments";

function planWithDeadlines(): BudgetPlan {
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
  venue.installments = [
    {
      id: "overdue",
      kind: "installment",
      label: "Second payment",
      amountPence: 200_000,
      paidPence: 50_000,
      dueDate: "2026-07-01",
      paidAt: null,
    },
    {
      id: "soon",
      kind: "final",
      label: "Final balance",
      amountPence: 300_000,
      paidPence: 0,
      dueDate: "2026-08-10",
      paidAt: null,
    },
    {
      id: "unknown",
      kind: "other",
      label: "Damage deposit",
      amountPence: null,
      paidPence: 0,
      dueDate: "2026-10-01",
      paidAt: null,
    },
  ];
  return { ...plan, items: [venue] };
}

describe("Planning Hub payment guidance", () => {
  it("summarises known and unknown commitments without losing deadline order", () => {
    const overview = getPlanningHubPaymentOverview(
      planWithDeadlines(),
      new Date("2026-07-28T12:00:00"),
    );

    expect(overview).toMatchObject({
      overdueCount: 1,
      dueSoonCount: 1,
      upcomingCount: 1,
      knownOutstandingPence: 450_000,
      unknownAmountCount: 1,
    });
    expect(overview.deadlines.map((deadline) => deadline.label))
      .toEqual(["Second payment", "Final balance", "Damage deposit"]);
  });

  it("routes a payment back to its stage while retaining shared workspace identity", () => {
    const plan = planWithDeadlines();
    const deadline = getPlanningHubPaymentOverview(
      plan,
      new Date("2026-07-28T12:00:00"),
    ).deadlines[0];

    expect(getPlanningHubPaymentDeadlineHref(
      plan,
      deadline,
      "60000000-0000-4000-8000-000000000006",
    )).toBe(
      `/planning-hub?planItem=${plan.items[0].id}&workspace=60000000-0000-4000-8000-000000000006#current-venue-payments`,
    );
  });

  it("falls back to the Organise commitments when the source item is unavailable", () => {
    const plan = planWithDeadlines();
    const deadline = {
      ...getPlanningHubPaymentOverview(
        plan,
        new Date("2026-07-28T12:00:00"),
      ).deadlines[0],
      itemId: "missing-item",
    };

    expect(getPlanningHubPaymentDeadlineHref(plan, deadline)).toBe(
      "/planning-hub/organise#planning-hub-payment-commitments",
    );
  });

  it("opens the photography payment editor for a photography commitment", () => {
    const plan = planWithDeadlines();
    plan.items[0] = {
      ...plan.items[0],
      categoryId: "photography",
      supplierType: "Photographer",
    };
    const deadline = getPlanningHubPaymentOverview(
      plan,
      new Date("2026-07-28T12:00:00"),
    ).deadlines[0];

    expect(getPlanningHubPaymentDeadlineHref(plan, deadline)).toBe(
      `/planning-hub/photography?planItem=${plan.items[0].id}#current-photographer-payments`,
    );
  });

  it("keeps a manual-only supplier commitment in Organise until its catalogue stage is live", () => {
    const plan = planWithDeadlines();
    plan.items[0] = {
      ...plan.items[0],
      categoryId: "videography",
      supplierType: "Videographer",
    };
    const deadline = getPlanningHubPaymentOverview(
      plan,
      new Date("2026-07-28T12:00:00"),
    ).deadlines[0];

    expect(getPlanningHubPaymentDeadlineHref(plan, deadline)).toBe(
      "/planning-hub/organise#planning-hub-payment-commitments",
    );
  });
});
