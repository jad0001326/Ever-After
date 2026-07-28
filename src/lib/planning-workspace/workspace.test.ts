import { describe, expect, it } from "vitest";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import type { BudgetItem } from "@/lib/budget/types";
import { createExampleTablePlan } from "@/lib/table-plan/planner";
import {
  createEmptyPlanningWorkspace,
  createPlanningTask,
  getPlanningRecommendation,
  restorePlanningWorkspace,
  serializePlanningWorkspace,
} from "./workspace";

function budgetItem(categoryId: string): BudgetItem {
  const now = "2026-07-26T10:00:00.000Z";
  return {
    id: `${categoryId}-item`,
    categoryId,
    listingId: null,
    listingType: null,
    listingUrl: null,
    imageUrl: null,
    source: "manual",
    itemName: categoryId,
    supplierName: null,
    supplierType: null,
    description: null,
    estimatedCostPence: 100_000,
    confirmedCostPence: null,
    importedPricePence: null,
    importedPriceToPence: null,
    importedPriceType: null,
    costPerPersonPence: null,
    guestCount: null,
    depositPaidPence: 0,
    totalPaidPence: 0,
    installments: [],
    costStatus: "estimated",
    paymentStatus: "not_started",
    bookingStatus: "shortlisted",
    dueDate: null,
    websiteUrl: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    sortOrder: 0,
  };
}

describe("planning workspace", () => {
  it("round-trips a workspace while preserving the existing table-plan contract", () => {
    const workspace = createEmptyPlanningWorkspace({
      ownerId: "user-1",
      budgetPlanId: "budget-1",
      tablePlan: createExampleTablePlan(),
    });
    workspace.tasks = [createPlanningTask("Confirm final numbers", { category: "guests" })];

    expect(restorePlanningWorkspace(serializePlanningWorkspace(workspace))).toEqual(workspace);
  });

  it("rejects malformed workspace records instead of partially restoring private planning data", () => {
    expect(restorePlanningWorkspace('{"schemaVersion":1,"id":"bad"}')).toBeNull();
    expect(restorePlanningWorkspace(JSON.stringify({
      ...createEmptyPlanningWorkspace({ ownerId: null, budgetPlanId: "budget-1" }),
      tasks: [{ id: "task-1", title: "Unsafe partial task" }],
    }))).toBeNull();
  });

  it("recommends venue, photography, guests and tables in planning order", () => {
    const budget = createEmptyBudgetPlan();
    const workspace = createEmptyPlanningWorkspace({ ownerId: null, budgetPlanId: budget.id });
    budget.location = "Perthshire";
    budget.guestCount = 90;
    budget.totalBudgetPence = 2_500_000;
    workspace.profile = {
      ...workspace.profile,
      location: "Perthshire",
      guestCount: 90,
      priorities: ["venue", "photography"],
      photographyStyles: ["Documentary"],
    };
    expect(getPlanningRecommendation(budget, workspace).stage).toBe("venue");
    expect(getPlanningRecommendation(budget, workspace).href)
      .toBe("/planning-hub?location=Perthshire&guests=90&budget=25000");
    expect(getPlanningRecommendation(
      budget,
      workspace,
      "60000000-0000-4000-8000-000000000006",
    ).href).toContain("workspace=60000000-0000-4000-8000-000000000006");

    budget.items = [budgetItem("venue")];
    expect(getPlanningRecommendation(budget, workspace).stage).toBe("photography");
    expect(getPlanningRecommendation(budget, workspace).href)
      .toContain("style=Documentary");
    expect(getPlanningRecommendation(
      budget,
      workspace,
      "60000000-0000-4000-8000-000000000006",
    ).href).toContain("workspace=60000000-0000-4000-8000-000000000006");

    budget.items.push(budgetItem("photography"));
    expect(getPlanningRecommendation(budget, workspace).stage).toBe("guests");
    expect(getPlanningRecommendation(
      budget,
      workspace,
      "60000000-0000-4000-8000-000000000006",
    ).href).toBe("/planning-hub/organise?workspace=60000000-0000-4000-8000-000000000006");

    workspace.tablePlan = createExampleTablePlan();
    expect(getPlanningRecommendation(budget, workspace).stage).toBe("tables");

    workspace.tablePlan.guests = workspace.tablePlan.guests.map((guest, index) => ({
      ...guest,
      tableId: workspace.tablePlan.tables[0].id,
      seatIndex: index,
    }));
    expect(getPlanningRecommendation(budget, workspace).stage).toBe("tasks");
  });

  it("prioritises an overdue payment before the ordinary planning sequence", () => {
    const budget = createEmptyBudgetPlan();
    const workspace = createEmptyPlanningWorkspace({ ownerId: null, budgetPlanId: budget.id });
    const venue = budgetItem("venue");
    venue.itemName = "Venue One";
    venue.installments = [{
      id: "final",
      kind: "final",
      label: "Final balance",
      amountPence: 400_000,
      paidPence: 0,
      dueDate: "2026-07-01",
      paidAt: null,
    }];
    budget.items = [venue];
    workspace.tasks = [
      createPlanningTask("Confirm guest numbers", {
        category: "guests",
        dueDate: "2026-07-10",
      }),
    ];

    const recommendation = getPlanningRecommendation(
      budget,
      workspace,
      "60000000-0000-4000-8000-000000000006",
      new Date("2026-07-28T12:00:00"),
    );

    expect(recommendation).toMatchObject({
      stage: "payments",
      title: "Review Venue One payment",
    });
    expect(recommendation.href)
      .toBe("/planning-hub?workspace=60000000-0000-4000-8000-000000000006#payment-deadlines-title");
  });

  it("prioritises the earliest overdue task before ordinary discovery stages", () => {
    const budget = createEmptyBudgetPlan();
    const workspace = createEmptyPlanningWorkspace({ ownerId: null, budgetPlanId: budget.id });
    workspace.tasks = [
      createPlanningTask("Confirm flowers", {
        category: "general",
        dueDate: "2026-07-20",
        sortOrder: 1,
      }),
      createPlanningTask("Confirm guest numbers", {
        category: "guests",
        dueDate: "2026-07-10",
        sortOrder: 0,
      }),
    ];

    const recommendation = getPlanningRecommendation(
      budget,
      workspace,
      "60000000-0000-4000-8000-000000000006",
      new Date("2026-07-28T12:00:00"),
    );

    expect(recommendation).toEqual({
      stage: "tasks",
      title: "Review Confirm guest numbers",
      href: "/planning-hub/organise?workspace=60000000-0000-4000-8000-000000000006#planning-tasks-title",
      reason: "Guests task due 10 Jul 2026. Complete it or update the plan before moving on.",
    });
  });
});
