import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PlanningSetupUpdateRequest,
  PlanningWorkspaceImportRequest,
} from "./connection-api-schema";
import type { Database, Json } from "@/types/database";

type PlanningSupabaseClient = SupabaseClient<Database>;

type ConnectionFailure = Readonly<{
  ok: false;
  reason: "conflict" | "invalid" | "not_found" | "too_large" | "unavailable";
}>;

export async function importPlanningWorkspaceConnection(
  supabase: PlanningSupabaseClient,
  userId: string,
  request: PlanningWorkspaceImportRequest,
  now = new Date(),
) {
  const budgetPlan = {
    ...request.budgetPlan,
    userId,
    updatedAt: nextVersion(request.budgetPlan.updatedAt, now),
  };
  const { data, error } = await supabase.rpc(
    "import_planning_workspace_with_budget_v2",
    {
      workspace_snapshot: request.snapshot as unknown as Json,
      budget_plan: budgetPlan as unknown as Json,
      target_workspace_id: request.targetWorkspaceId,
      expected_updated_at: request.expectedWorkspaceUpdatedAt,
    },
  );
  if (error) return rpcFailure(error.code);
  const imported = data?.[0];
  return imported
    ? ({ ok: true, workspaceId: imported.workspace_id } as const)
    : ({ ok: false, reason: "unavailable" } satisfies ConnectionFailure);
}

export async function updatePlanningWorkspaceSetup(
  supabase: PlanningSupabaseClient,
  workspaceId: string,
  request: PlanningSetupUpdateRequest,
) {
  const { profile } = request.setup;
  const { data, error } = await supabase.rpc(
    "update_planning_workspace_setup_v1",
    {
      target_workspace_id: workspaceId,
      setup_total_budget_pence: request.setup.totalBudgetPence,
      setup_wedding_date: profile.weddingDate,
      setup_guest_count: profile.guestCount,
      setup_location: profile.location,
      setup_date_flexibility: profile.dateFlexibility,
      setup_location_flexible: profile.locationFlexible,
      setup_priorities: profile.priorities,
      setup_venue_styles: profile.venueStyles,
      setup_photography_styles: profile.photographyStyles,
      setup_vision: profile.vision,
      expected_workspace_updated_at: request.expectedVersions.workspaceUpdatedAt,
      expected_budget_updated_at: request.expectedVersions.budgetUpdatedAt,
      expected_profile_updated_at: request.expectedVersions.profileUpdatedAt,
    },
  );
  if (error) return rpcFailure(error.code);
  const updated = data?.[0];
  return updated
    ? ({ ok: true, versions: {
      workspaceUpdatedAt: updated.workspace_updated_at,
      budgetUpdatedAt: updated.budget_updated_at,
      profileUpdatedAt: updated.profile_updated_at,
    } } as const)
    : ({ ok: false, reason: "unavailable" } satisfies ConnectionFailure);
}

function rpcFailure(code: string | undefined): ConnectionFailure {
  if (code === "P4090" || code === "23505") {
    return { ok: false, reason: "conflict" };
  }
  if (code === "22023") return { ok: false, reason: "invalid" };
  if (code === "P0002" || code === "42501") {
    return { ok: false, reason: "not_found" };
  }
  if (code === "54000") return { ok: false, reason: "too_large" };
  return { ok: false, reason: "unavailable" };
}

function nextVersion(previous: string, now: Date) {
  const previousTime = Date.parse(previous);
  return new Date(Math.max(now.getTime(), previousTime + 1)).toISOString();
}
