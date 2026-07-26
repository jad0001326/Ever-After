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
    expect(getPlanningRecommendation(budget, workspace).stage).toBe("venue");

    budget.items = [budgetItem("venue")];
    expect(getPlanningRecommendation(budget, workspace).stage).toBe("photography");

    budget.items.push(budgetItem("photography"));
    expect(getPlanningRecommendation(budget, workspace).stage).toBe("guests");

    workspace.tablePlan = createExampleTablePlan();
    expect(getPlanningRecommendation(budget, workspace).stage).toBe("tables");

    workspace.tablePlan.guests = workspace.tablePlan.guests.map((guest, index) => ({
      ...guest,
      tableId: workspace.tablePlan.tables[0].id,
      seatIndex: index,
    }));
    expect(getPlanningRecommendation(budget, workspace).stage).toBe("tasks");
  });
});
