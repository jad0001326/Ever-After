export * from "@everaft/planning-domain/table-plan/planner";

import type { TablePlan } from "@everaft/planning-domain/table-plan/types";

export const TABLE_PLAN_STORAGE_KEY = "everaft:table-plan:v1";

export function restoreTablePlan(raw: string | null): TablePlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TablePlan>;
    if (
      parsed.schemaVersion !== 1
      || typeof parsed.id !== "string"
      || !Array.isArray(parsed.guests)
      || !Array.isArray(parsed.tables)
      || !Array.isArray(parsed.rules)
    ) {
      return null;
    }
    return parsed as TablePlan;
  } catch {
    return null;
  }
}

export function serializeTablePlan(plan: TablePlan) {
  return JSON.stringify({ ...plan, schemaVersion: 1 });
}
