import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type PlanningSupabaseClient = SupabaseClient<Database>;
type PlanningWorkspaceRow =
  Database["public"]["Tables"]["planning_workspaces"]["Row"];
type PlanningWorkspaceMemberRow =
  Database["public"]["Tables"]["planning_workspace_members"]["Row"];

const workspaceColumns =
  "id, name, budget_plan_id, created_at, updated_at";
const membershipColumns = "workspace_id, role";

export async function listPlanningWorkspaces(
  supabase: PlanningSupabaseClient,
  userId: string,
  offset: number,
  limit: number,
) {
  const { data, error } = await supabase
    .from("planning_workspaces")
    .select(workspaceColumns)
    .order("updated_at", { ascending: false })
    .order("id")
    .range(offset, offset + limit);
  if (error) return { ok: false, reason: "unavailable" } as const;

  const rows = (data ?? []).slice(0, limit);
  if (rows.length === 0) {
    return {
      ok: true,
      workspaces: [],
      hasMore: (data?.length ?? 0) > limit,
    } as const;
  }

  const workspaceIds = rows.map((row) => row.id);
  const memberships = await supabase
    .from("planning_workspace_members")
    .select(membershipColumns)
    .eq("user_id", userId)
    .in("workspace_id", workspaceIds);
  if (memberships.error) {
    return { ok: false, reason: "unavailable" } as const;
  }

  const roles = roleByWorkspace(memberships.data ?? []);
  if (
    !roles
    || workspaceIds.some((workspaceId) => !roles.has(workspaceId))
  ) {
    return { ok: false, reason: "invalid_result" } as const;
  }

  return {
    ok: true,
    workspaces: rows.map((row) => workspaceFromRow(
      row,
      roles.get(row.id) as PlanningWorkspaceMemberRow["role"],
    )),
    hasMore: (data?.length ?? 0) > limit,
  } as const;
}

function roleByWorkspace(
  rows: Pick<PlanningWorkspaceMemberRow, "workspace_id" | "role">[],
) {
  const roles = new Map<string, PlanningWorkspaceMemberRow["role"]>();
  for (const row of rows) {
    if (roles.has(row.workspace_id)) return null;
    roles.set(row.workspace_id, row.role);
  }
  return roles;
}

function workspaceFromRow(
  row: Pick<
    PlanningWorkspaceRow,
    "id" | "name" | "budget_plan_id" | "created_at" | "updated_at"
  >,
  role: PlanningWorkspaceMemberRow["role"],
) {
  return {
    schemaVersion: 1 as const,
    id: row.id,
    name: row.name,
    budgetPlanId: row.budget_plan_id,
    role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
