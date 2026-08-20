import { describe, expect, it } from "vitest";
import { calculateBudget } from "./budget/calculations";
import { createEmptyBudgetPlan } from "./budget/factory";
import { createPlanningHubStarterPlan } from "./planning-hub/plan";
import { supplierCategoryBySlug } from "./planning-hub/supplier-categories";
import { createPlanningId } from "./ids";

describe("planning-domain package boundary", () => {
  it("keeps the existing starter-plan and category behavior available", () => {
    const empty = createEmptyBudgetPlan(null);
    const starter = createPlanningHubStarterPlan(null);

    expect(calculateBudget(empty).allocatedPence).toBe(0);
    expect(starter.totalBudgetPence).toBe(2_000_000);
    expect(starter.guestCount).toBe(80);
    expect(supplierCategoryBySlug("photographer")?.budgetCategoryId).toBe("photography");
    expect(createPlanningId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
