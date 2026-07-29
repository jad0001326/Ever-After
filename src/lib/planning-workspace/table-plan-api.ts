import type { SupabaseClient } from "@supabase/supabase-js";
import type { TablePlan } from "@/lib/table-plan/types";
import type { Database, Json } from "@/types/database";

type PlanningSupabaseClient = SupabaseClient<Database>;

export async function syncPlanningTablePlan(
  supabase: PlanningSupabaseClient,
  workspaceId: string,
  tablePlan: TablePlan,
  expectedWorkspaceUpdatedAt: string,
) {
  const { data, error } = await supabase.rpc("sync_planning_table_plan", {
    target_workspace_id: workspaceId,
    table_plan: tablePlan as unknown as Json,
    expected_updated_at: expectedWorkspaceUpdatedAt,
  });

  if (error?.code === "40001") {
    return { ok: false, reason: "version_conflict" } as const;
  }
  const synced = data?.[0];
  if (error || !synced) {
    return { ok: false, reason: "unavailable" } as const;
  }
  return {
    ok: true,
    workspaceId,
    savedAt: synced.workspace_updated_at,
  } as const;
}
