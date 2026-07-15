import { describe, expect, it } from "vitest";
import { calculateBudget } from "./calculations";
import { budgetStarters, createStarterBudgetPlan, getBudgetStarter } from "./starters";

describe("starter wedding budgets", () => {
  it("provides the three shareable budget levels", () => {
    expect(budgetStarters.map((starter) => starter.slug)).toEqual(["15000", "20000", "30000"]);
    expect(getBudgetStarter("20000")?.totalBudgetPence).toBe(2_000_000);
    expect(getBudgetStarter("unknown")).toBeUndefined();
  });

  it.each(budgetStarters)("creates an editable $label plan within budget", (starter) => {
    const plan = createStarterBudgetPlan(starter);
    const summary = calculateBudget(plan);

    expect(plan.id).toBe(`starter-${starter.slug}`);
    expect(plan.items).toHaveLength(starter.allocations.length);
    expect(plan.items.every((item) => item.costStatus === "estimated" && item.source === "manual")).toBe(true);
    expect(plan.contingencyType).toBe("percentage");
    expect(plan.contingencyValue).toBe(5);
    expect(summary.remainingPence).toBeGreaterThanOrEqual(0);
    expect(summary.allocatedPence).toBeGreaterThan(starter.totalBudgetPence * 0.85);
  });

  it("uses deterministic identifiers so server and client renders agree", () => {
    const starter = budgetStarters[0];
    expect(createStarterBudgetPlan(starter)).toEqual(createStarterBudgetPlan(starter));
  });
});
