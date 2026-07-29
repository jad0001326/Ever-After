import type { SupabaseClient } from "@supabase/supabase-js";
import type { BudgetPlan } from "@/lib/budget/types";
import type { Database, Json } from "@/types/database";

type PlanningSupabaseClient = SupabaseClient<Database>;

export async function updatePlanningBudgetPlan(
  supabase: PlanningSupabaseClient,
  ownerId: string,
  plan: BudgetPlan,
  expectedUpdatedAt: string,
  referenceDate = new Date(),
) {
  const updatedAt = nextVersion(expectedUpdatedAt, referenceDate);
  const persistedPlan: BudgetPlan = {
    ...plan,
    userId: ownerId,
    updatedAt,
  };
  const { data, error } = await supabase
    .from("budget_plans")
    .update({
      name: persistedPlan.name,
      scenario_name: persistedPlan.scenarioName,
      currency: persistedPlan.currency,
      total_budget_pence: persistedPlan.totalBudgetPence,
      plan_json: persistedPlan as unknown as Json,
      updated_at: updatedAt,
    })
    .eq("user_id", ownerId)
    .eq("id", persistedPlan.id)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at")
    .maybeSingle();

  if (error) {
    return { ok: false, reason: "unavailable" } as const;
  }
  if (!data) {
    return { ok: false, reason: "version_conflict" } as const;
  }
  return {
    ok: true,
    budgetPlanId: persistedPlan.id,
    savedAt: data.updated_at,
  } as const;
}

function nextVersion(expectedUpdatedAt: string, referenceDate: Date) {
  const expectedTime = Date.parse(expectedUpdatedAt);
  const nextTime = Number.isNaN(expectedTime)
    ? referenceDate.getTime()
    : Math.max(referenceDate.getTime(), expectedTime + 1);
  return new Date(nextTime).toISOString();
}
