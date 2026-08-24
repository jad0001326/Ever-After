import { createDefaultCategories } from "./categories";
import type { BudgetPlan } from "./types";
import { createPlanningId } from "../ids";

export function createEmptyBudgetPlan(userId: string | null = null): BudgetPlan {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: createPlanningId(),
    userId,
    name: "Our wedding budget",
    totalBudgetPence: 0,
    currency: "GBP",
    weddingDate: null,
    guestCount: null,
    location: null,
    contingencyType: "none",
    contingencyValue: 5,
    createdAt: now,
    updatedAt: now,
    selectedVenueId: null,
    scenarioName: "Current plan",
    categories: createDefaultCategories(),
    items: [],
  };
}
