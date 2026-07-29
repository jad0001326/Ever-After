import type { SupabaseClient } from "@supabase/supabase-js";
import { budgetPlanSchema } from "@/lib/budget/validation";
import type { Database } from "@/types/database";

type PlanningSupabaseClient = SupabaseClient<Database>;
type LoadFailure = { ok: false; message: string };

export async function loadPlanningWorkspaceSnapshot(
  supabase: PlanningSupabaseClient,
  id: string,
  options: { includeSharing?: boolean } = {},
) {
  const includeSharing = options.includeSharing ?? true;
  const [
    workspaceResult,
    profileResult,
    memberResult,
    taskResult,
    guestResult,
    tableResult,
    seatResult,
    ruleResult,
    inviteResult,
  ] = await Promise.all([
    supabase.from("planning_workspaces").select("*").eq("id", id).maybeSingle(),
    supabase.from("planning_workspace_profiles").select("*").eq("workspace_id", id).maybeSingle(),
    includeSharing
      ? supabase.from("planning_workspace_members").select("*").eq("workspace_id", id)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("planning_tasks").select("*").eq("workspace_id", id).order("sort_order").order("created_at"),
    supabase.from("planning_guests").select("*").eq("workspace_id", id).order("sort_order").order("name"),
    supabase.from("planning_tables").select("*").eq("workspace_id", id).order("sort_order").order("created_at"),
    supabase.from("planning_seats").select("*").eq("workspace_id", id),
    supabase.from("planning_seating_rules").select("*").eq("workspace_id", id),
    includeSharing
      ? supabase.from("planning_workspace_invites")
          .select("id, workspace_id, email_normalized, role, expires_at, accepted_at, accepted_by, revoked_at, created_at")
          .eq("workspace_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const error = [
    workspaceResult,
    profileResult,
    memberResult,
    taskResult,
    guestResult,
    tableResult,
    seatResult,
    ruleResult,
    inviteResult,
  ].find((result) => result.error)?.error;

  if (error || !workspaceResult.data) {
    return {
      ok: false,
      message: "That connected plan is unavailable or you no longer have access.",
    } satisfies LoadFailure;
  }

  return {
    ok: true,
    workspace: workspaceResult.data,
    profile: profileResult.data,
    members: memberResult.data ?? [],
    tasks: taskResult.data ?? [],
    guests: guestResult.data ?? [],
    tables: tableResult.data ?? [],
    seats: seatResult.data ?? [],
    seatingRules: ruleResult.data ?? [],
    invites: inviteResult.data ?? [],
  } as const;
}

export async function loadPlanningWorkspaceContext(
  supabase: PlanningSupabaseClient,
  id: string,
  userId: string,
  options: { includeSharing?: boolean } = {},
) {
  const snapshot = await loadPlanningWorkspaceSnapshot(supabase, id, options);
  if (!snapshot.ok) return snapshot;
  if (!snapshot.workspace.budget_plan_id) {
    return {
      ok: false,
      message: "That workspace is not linked to a wedding budget.",
    } satisfies LoadFailure;
  }

  const { data, error } = await supabase
    .from("budget_plans")
    .select("plan_json")
    .eq("user_id", snapshot.workspace.owner_id)
    .eq("id", snapshot.workspace.budget_plan_id)
    .maybeSingle();
  const budgetPlan = budgetPlanSchema.safeParse(data?.plan_json);
  if (error || !budgetPlan.success) {
    return {
      ok: false,
      message: "The connected wedding budget is unavailable.",
    } satisfies LoadFailure;
  }

  return {
    ok: true,
    budgetPlan: {
      ...budgetPlan.data,
      userId: snapshot.workspace.owner_id,
    },
    isOwner: snapshot.workspace.owner_id === userId,
    snapshot,
  } as const;
}
