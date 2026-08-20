import { createDefaultCategories } from "./categories";
import { createEmptyBudgetPlan } from "@everaft/planning-domain/budget/factory";
import type { BudgetPlan } from "./types";

export { createEmptyBudgetPlan } from "@everaft/planning-domain/budget/factory";

export const BUDGET_STORAGE_KEY = "everaft:wedding-budget:v1";
export function planningHubBudgetStorageKey(workspaceId?: string | null) {
  return workspaceId
    ? `${BUDGET_STORAGE_KEY}:workspace:${workspaceId}`
    : BUDGET_STORAGE_KEY;
}
export function restoreBudgetPlan(raw: string | null): BudgetPlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BudgetPlan>;
    if (parsed.schemaVersion !== 1 || typeof parsed.id !== "string" || !Array.isArray(parsed.items)) return null;
    const defaults = createDefaultCategories();
    const existingIds = new Set((parsed.categories ?? []).map((category) => category.id));
    return {
      ...createEmptyBudgetPlan(parsed.userId ?? null),
      ...parsed,
      categories: [...(parsed.categories ?? []), ...defaults.filter((category) => !existingIds.has(category.id))],
      items: parsed.items.map((item) => ({
        ...item,
        installments: Array.isArray(item.installments) ? item.installments : [],
        availabilityStatus: ["not_checked", "enquiry_sent", "available", "unavailable"]
          .includes(item.availabilityStatus)
          ? item.availabilityStatus
          : "not_checked",
        availabilityDate: typeof item.availabilityDate === "string"
          ? item.availabilityDate
          : null,
      })),
      schemaVersion: 1,
    } as BudgetPlan;
  } catch { return null; }
}
export function serializeBudgetPlan(plan: BudgetPlan) { return JSON.stringify({ ...plan, schemaVersion: 1 }); }

