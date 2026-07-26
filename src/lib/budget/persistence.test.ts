import { describe, expect, it } from "vitest";
import { BUDGET_STORAGE_KEY, createEmptyBudgetPlan, planningHubBudgetStorageKey, restoreBudgetPlan, serializeBudgetPlan } from "./persistence";
describe("budget persistence", () => {
  it("uses a versioned local-storage key", () => expect(BUDGET_STORAGE_KEY).toContain("v1"));
  it("isolates a shared plan without changing the personal key", () => {
    expect(planningHubBudgetStorageKey()).toBe(BUDGET_STORAGE_KEY);
    expect(planningHubBudgetStorageKey("workspace-a")).toBe(`${BUDGET_STORAGE_KEY}:workspace:workspace-a`);
    expect(planningHubBudgetStorageKey("workspace-b")).not.toBe(planningHubBudgetStorageKey("workspace-a"));
  });
  it("restores a saved plan and merges newly introduced default categories", () => { const plan = createEmptyBudgetPlan(); plan.totalBudgetPence = 2_500_050; plan.categories = plan.categories.slice(0, 2); const restored = restoreBudgetPlan(serializeBudgetPlan(plan)); expect(restored?.totalBudgetPence).toBe(2_500_050); expect(restored?.categories.length).toBeGreaterThan(2); });
  it("adds an empty instalment schedule to legacy saved items", () => {
    const plan = createEmptyBudgetPlan();
    const legacyItem = {
      id: "legacy-item", categoryId: "venue", listingId: null, listingType: null, listingUrl: null, imageUrl: null, source: "manual",
      itemName: "Legacy venue", supplierName: null, supplierType: null, description: null, estimatedCostPence: 100_000,
      confirmedCostPence: null, importedPricePence: null, importedPriceToPence: null, importedPriceType: null, costPerPersonPence: null,
      guestCount: null, depositPaidPence: 10_000, totalPaidPence: 10_000, costStatus: "deposit_paid", paymentStatus: "deposit_paid",
      bookingStatus: "booked", dueDate: "2027-01-01", websiteUrl: null, notes: null, createdAt: plan.createdAt, updatedAt: plan.updatedAt, sortOrder: 0,
    };
    expect(restoreBudgetPlan(JSON.stringify({ ...plan, items: [legacyItem] }))?.items[0].installments).toEqual([]);
  });
  it("rejects corrupt or unsupported data", () => { expect(restoreBudgetPlan("not-json")).toBeNull(); expect(restoreBudgetPlan(JSON.stringify({ schemaVersion: 2, id: "old", items: [] }))).toBeNull(); });
});
