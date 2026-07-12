import { createDefaultCategories } from "./categories";
import type { BudgetPlan } from "./types";

export const BUDGET_STORAGE_KEY = "everaft:wedding-budget:v1";
function randomId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function createEmptyBudgetPlan(userId: string | null = null): BudgetPlan {
  const now = new Date().toISOString();
  return { schemaVersion: 1, id: randomId(), userId, name: "Our wedding budget", totalBudgetPence: 0, currency: "GBP", weddingDate: null, guestCount: null, location: null, contingencyType: "none", contingencyValue: 5, createdAt: now, updatedAt: now, selectedVenueId: null, scenarioName: "Current plan", categories: createDefaultCategories(), items: [] };
}

export function restoreBudgetPlan(raw: string | null): BudgetPlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BudgetPlan>;
    if (parsed.schemaVersion !== 1 || typeof parsed.id !== "string" || !Array.isArray(parsed.items)) return null;
    const defaults = createDefaultCategories();
    const existingIds = new Set((parsed.categories ?? []).map((category) => category.id));
    return { ...createEmptyBudgetPlan(parsed.userId ?? null), ...parsed, categories: [...(parsed.categories ?? []), ...defaults.filter((category) => !existingIds.has(category.id))], items: parsed.items, schemaVersion: 1 } as BudgetPlan;
  } catch { return null; }
}
export function serializeBudgetPlan(plan: BudgetPlan) { return JSON.stringify({ ...plan, schemaVersion: 1 }); }

