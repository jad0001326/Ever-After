import { describe, expect, it } from "vitest";
import { BUDGET_STORAGE_KEY, createEmptyBudgetPlan, restoreBudgetPlan, serializeBudgetPlan } from "./persistence";
describe("budget persistence", () => {
  it("uses a versioned local-storage key", () => expect(BUDGET_STORAGE_KEY).toContain("v1"));
  it("restores a saved plan and merges newly introduced default categories", () => { const plan = createEmptyBudgetPlan(); plan.totalBudgetPence = 2_500_050; plan.categories = plan.categories.slice(0, 2); const restored = restoreBudgetPlan(serializeBudgetPlan(plan)); expect(restored?.totalBudgetPence).toBe(2_500_050); expect(restored?.categories.length).toBeGreaterThan(2); });
  it("rejects corrupt or unsupported data", () => { expect(restoreBudgetPlan("not-json")).toBeNull(); expect(restoreBudgetPlan(JSON.stringify({ schemaVersion: 2, id: "old", items: [] }))).toBeNull(); });
});
