"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { absoluteUrl } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import {
  planningInviteCookieOptions,
  PLANNING_INVITE_COOKIE
} from "@/lib/planning-workspace/invite";
import {
  createPlanningInviteSchema,
  ensurePlanningWorkspaceSchema,
  importPlanningWorkspaceSchema,
  planningGuestInputSchema,
  planningGuestUpdateSchema,
  planningInviteTokenSchema,
  planningRecordIdSchema,
  planningSeatInputSchema,
  planningSeatingRuleInputSchema,
  planningTableInputSchema,
  planningTableUpdateSchema,
  planningTaskInputSchema,
  planningTaskUpdateSchema,
  planningWorkspaceIdSchema
} from "@/lib/planning-workspace/validation";
import type { Json } from "@/types/database";

const CLOUD_DISABLED_MESSAGE =
  "Connected planning is still in private testing. Your current plan remains saved on this device.";
const AUTH_REQUIRED_MESSAGE = "Sign in to use your connected wedding plan.";
const SAVE_FAILED_MESSAGE = "That change could not be saved. Please try again.";

type ActionFailure = { ok: false; message: string };
export type PlanningInviteAcceptanceState = {
  status: "idle" | "error" | "success";
  message: string;
  workspaceId?: string;
};

function isPlanningWorkspaceCloudEnabled() {
  return process.env.PLANNING_WORKSPACE_CLOUD_ENABLED === "true";
}

async function getPlanningContext() {
  if (!isPlanningWorkspaceCloudEnabled()) {
    return { ok: false, message: CLOUD_DISABLED_MESSAGE } as const;
  }

  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, message: CLOUD_DISABLED_MESSAGE } as const;
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, message: AUTH_REQUIRED_MESSAGE } as const;
  }

  return { ok: true, supabase, user } as const;
}

export async function ensurePlanningWorkspaceAction(input: unknown) {
  const parsed = ensurePlanningWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid budget plan before connecting this workspace." } satisfies ActionFailure;
  }

  const context = await getPlanningContext();
  if (!context.ok) return context;

  const { supabase, user } = context;
  const { budgetPlanId, name } = parsed.data;
  const { data: existing, error: readError } = await supabase
    .from("planning_workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .eq("budget_plan_id", budgetPlanId)
    .maybeSingle();

  if (readError) return { ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure;
  if (existing) return { ok: true, workspace: existing } as const;

  const { data: workspace, error: insertError } = await supabase
    .from("planning_workspaces")
    .insert({
      owner_id: user.id,
      budget_plan_id: budgetPlanId,
      name
    })
    .select("*")
    .single();

  if (insertError || !workspace) {
    return { ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure;
  }

  return { ok: true, workspace } as const;
}

export async function loadPlanningWorkspaceForBudgetAction(budgetPlanId: unknown) {
  const parsed = ensurePlanningWorkspaceSchema
    .pick({ budgetPlanId: true })
    .safeParse({ budgetPlanId });
  if (!parsed.success) {
    return { ok: false, message: "That connected budget plan could not be found." } satisfies ActionFailure;
  }

  const context = await getPlanningContext();
  if (!context.ok) return context;

  const { data: workspace, error } = await context.supabase
    .from("planning_workspaces")
    .select("*")
    .eq("budget_plan_id", parsed.data.budgetPlanId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure;
  if (!workspace) return { ok: true, snapshot: null } as const;

  const snapshot = await loadPlanningWorkspaceSnapshot(context.supabase, workspace.id);
  return snapshot.ok
    ? ({ ok: true, snapshot } as const)
    : snapshot;
}

export async function loadPlanningWorkspaceAction(workspaceId: unknown) {
  const parsed = planningWorkspaceIdSchema.safeParse(workspaceId);
  if (!parsed.success) {
    return { ok: false, message: "That connected plan could not be found." } satisfies ActionFailure;
  }

  const context = await getPlanningContext();
  if (!context.ok) return context;

  return loadPlanningWorkspaceSnapshot(context.supabase, parsed.data);
}

async function loadPlanningWorkspaceSnapshot(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  id: string
) {
  const [
    workspaceResult,
    profileResult,
    memberResult,
    taskResult,
    guestResult,
    tableResult,
    seatResult,
    ruleResult,
    inviteResult
  ] = await Promise.all([
    supabase.from("planning_workspaces").select("*").eq("id", id).maybeSingle(),
    supabase.from("planning_workspace_profiles").select("*").eq("workspace_id", id).maybeSingle(),
    supabase.from("planning_workspace_members").select("*").eq("workspace_id", id),
    supabase.from("planning_tasks").select("*").eq("workspace_id", id).order("sort_order").order("created_at"),
    supabase.from("planning_guests").select("*").eq("workspace_id", id).order("sort_order").order("name"),
    supabase.from("planning_tables").select("*").eq("workspace_id", id).order("sort_order").order("created_at"),
    supabase.from("planning_seats").select("*").eq("workspace_id", id),
    supabase.from("planning_seating_rules").select("*").eq("workspace_id", id),
    supabase.from("planning_workspace_invites")
      .select("id, workspace_id, email_normalized, role, expires_at, accepted_at, accepted_by, revoked_at, created_at")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false })
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
    inviteResult
  ].find((result) => result.error)?.error;

  if (error || !workspaceResult.data) {
    return { ok: false, message: "That connected plan is unavailable or you no longer have access." } satisfies ActionFailure;
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
    invites: inviteResult.data ?? []
  } as const;
}

export async function importPlanningWorkspaceSnapshotAction(input: unknown) {
  const parsed = importPlanningWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "This device plan is not ready for secure import. Review its tasks, guests and table seats first."
    } satisfies ActionFailure;
  }

  if (JSON.stringify(parsed.data.snapshot).length > 1_000_000) {
    return {
      ok: false,
      message: "This device plan is too large to import safely in one request."
    } satisfies ActionFailure;
  }

  const context = await getPlanningContext();
  if (!context.ok) return context;

  const { data, error } = await context.supabase.rpc(
    "import_planning_workspace_snapshot_v2",
    {
      workspace_snapshot: parsed.data.snapshot as unknown as Json,
      target_workspace_id: parsed.data.targetWorkspaceId,
      expected_updated_at: parsed.data.expectedUpdatedAt
    }
  );

  if (error) {
    if (error.code === "40001") {
      return {
        ok: false,
        message: "The cloud plan changed after this page loaded. Reload before choosing which copy to keep."
      } satisfies ActionFailure;
    }
    if (error.code === "23505") {
      return {
        ok: false,
        message: "A cloud plan now exists for this budget. Reload before trying again so nothing is overwritten."
      } satisfies ActionFailure;
    }
    return { ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure;
  }

  const importedWorkspace = data?.[0];
  if (!importedWorkspace) {
    return { ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure;
  }

  const snapshot = await loadPlanningWorkspaceSnapshot(
    context.supabase,
    importedWorkspace.workspace_id
  );
  return snapshot.ok
    ? ({ ok: true, snapshot } as const)
    : snapshot;
}

export async function createPlanningTaskAction(input: unknown) {
  const parsed = planningTaskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the task details and try again." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const value = parsed.data;
  const { data, error } = await context.supabase
    .from("planning_tasks")
    .insert({
      workspace_id: value.workspaceId,
      title: value.title,
      notes: value.notes,
      category: value.category,
      status: value.status,
      due_date: value.dueDate,
      sort_order: value.sortOrder
    })
    .select("*")
    .single();

  return error || !data
    ? ({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure)
    : ({ ok: true, task: data } as const);
}

export async function updatePlanningTaskAction(taskId: unknown, input: unknown) {
  const id = planningRecordIdSchema.safeParse(taskId);
  const parsed = planningTaskUpdateSchema.safeParse(input);
  if (!id.success || !parsed.success) return { ok: false, message: "Check the task details and try again." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const value = parsed.data;
  const { data, error } = await context.supabase
    .from("planning_tasks")
    .update({
      ...(value.title !== undefined ? { title: value.title } : {}),
      ...(value.notes !== undefined ? { notes: value.notes } : {}),
      ...(value.category !== undefined ? { category: value.category } : {}),
      ...(value.status !== undefined ? { status: value.status } : {}),
      ...(value.dueDate !== undefined ? { due_date: value.dueDate } : {}),
      ...(value.sortOrder !== undefined ? { sort_order: value.sortOrder } : {})
    })
    .eq("id", id.data)
    .select("*")
    .maybeSingle();

  return error || !data
    ? ({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure)
    : ({ ok: true, task: data } as const);
}

export async function deletePlanningTaskAction(taskId: unknown) {
  return deletePlanningRecord("planning_tasks", taskId);
}

export async function createPlanningGuestAction(input: unknown) {
  const parsed = planningGuestInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the guest details and try again." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const value = parsed.data;
  const { data, error } = await context.supabase
    .from("planning_guests")
    .insert({
      workspace_id: value.workspaceId,
      name: value.name,
      email: value.email,
      rsvp_status: value.rsvpStatus,
      dietary_notes: value.dietaryNotes,
      sort_order: value.sortOrder
    })
    .select("*")
    .single();

  return error || !data
    ? ({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure)
    : ({ ok: true, guest: data } as const);
}

export async function updatePlanningGuestAction(guestId: unknown, input: unknown) {
  const id = planningRecordIdSchema.safeParse(guestId);
  const parsed = planningGuestUpdateSchema.safeParse(input);
  if (!id.success || !parsed.success) return { ok: false, message: "Check the guest details and try again." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const value = parsed.data;
  const { data, error } = await context.supabase
    .from("planning_guests")
    .update({
      ...(value.name !== undefined ? { name: value.name } : {}),
      ...(value.email !== undefined ? { email: value.email } : {}),
      ...(value.rsvpStatus !== undefined ? { rsvp_status: value.rsvpStatus } : {}),
      ...(value.dietaryNotes !== undefined ? { dietary_notes: value.dietaryNotes } : {}),
      ...(value.sortOrder !== undefined ? { sort_order: value.sortOrder } : {})
    })
    .eq("id", id.data)
    .select("*")
    .maybeSingle();

  return error || !data
    ? ({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure)
    : ({ ok: true, guest: data } as const);
}

export async function deletePlanningGuestAction(guestId: unknown) {
  return deletePlanningRecord("planning_guests", guestId);
}

export async function createPlanningTableAction(input: unknown) {
  const parsed = planningTableInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the table details and try again." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const value = parsed.data;
  const { data, error } = await context.supabase
    .from("planning_tables")
    .insert({
      workspace_id: value.workspaceId,
      name: value.name,
      capacity: value.capacity,
      locked: value.locked,
      sort_order: value.sortOrder
    })
    .select("*")
    .single();

  return error || !data
    ? ({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure)
    : ({ ok: true, table: data } as const);
}

export async function updatePlanningTableAction(tableId: unknown, input: unknown) {
  const id = planningRecordIdSchema.safeParse(tableId);
  const parsed = planningTableUpdateSchema.safeParse(input);
  if (!id.success || !parsed.success) return { ok: false, message: "Check the table details and try again." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const value = parsed.data;
  const { data, error } = await context.supabase
    .from("planning_tables")
    .update({
      ...(value.name !== undefined ? { name: value.name } : {}),
      ...(value.capacity !== undefined ? { capacity: value.capacity } : {}),
      ...(value.locked !== undefined ? { locked: value.locked } : {}),
      ...(value.sortOrder !== undefined ? { sort_order: value.sortOrder } : {})
    })
    .eq("id", id.data)
    .select("*")
    .maybeSingle();

  return error || !data
    ? ({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure)
    : ({ ok: true, table: data } as const);
}

export async function deletePlanningTableAction(tableId: unknown) {
  return deletePlanningRecord("planning_tables", tableId);
}

export async function savePlanningSeatAction(input: unknown) {
  const parsed = planningSeatInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a valid guest, table and seat." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const value = parsed.data;
  const { data, error } = await context.supabase
    .from("planning_seats")
    .upsert({
      workspace_id: value.workspaceId,
      guest_id: value.guestId,
      table_id: value.tableId,
      seat_index: value.seatIndex
    }, { onConflict: "workspace_id,guest_id" })
    .select("*")
    .single();

  return error || !data
    ? ({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure)
    : ({ ok: true, seat: data } as const);
}

export async function deletePlanningSeatAction(workspaceId: unknown, guestId: unknown) {
  const workspace = planningWorkspaceIdSchema.safeParse(workspaceId);
  const guest = planningRecordIdSchema.safeParse(guestId);
  if (!workspace.success || !guest.success) return { ok: false, message: "That seat assignment is not valid." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const { error, count } = await context.supabase
    .from("planning_seats")
    .delete({ count: "exact" })
    .eq("workspace_id", workspace.data)
    .eq("guest_id", guest.data);

  return error || count !== 1
    ? ({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure)
    : ({ ok: true } as const);
}

export async function createPlanningSeatingRuleAction(input: unknown) {
  const parsed = planningSeatingRuleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose two different guests and a valid seating rule." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const value = parsed.data;
  const { data, error } = await context.supabase
    .from("planning_seating_rules")
    .insert({
      workspace_id: value.workspaceId,
      person_a_id: value.personAId,
      person_b_id: value.personBId,
      rule_type: value.ruleType
    })
    .select("*")
    .single();

  return error || !data
    ? ({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure)
    : ({ ok: true, seatingRule: data } as const);
}

export async function deletePlanningSeatingRuleAction(ruleId: unknown) {
  return deletePlanningRecord("planning_seating_rules", ruleId);
}

export async function createPlanningWorkspaceInviteAction(input: unknown) {
  const parsed = createPlanningInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a valid partner email address." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const { workspaceId, email } = parsed.data;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const { error: cleanupError } = await context.supabase
    .from("planning_workspace_invites")
    .update({ revoked_at: now.toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("email_normalized", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .lte("expires_at", now.toISOString());

  if (cleanupError) return { ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure;

  const { data: invite, error } = await context.supabase
    .from("planning_workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email_normalized: email,
      token_hash: tokenHash,
      invited_by: context.user.id,
      expires_at: expiresAt.toISOString()
    })
    .select("id, workspace_id, email_normalized, role, expires_at, accepted_at, accepted_by, revoked_at, created_at")
    .single();

  if (error || !invite) {
    return {
      ok: false,
      message: error?.code === "23505"
        ? "There is already an active invitation for this email address."
        : SAVE_FAILED_MESSAGE
    } satisfies ActionFailure;
  }

  return {
    ok: true,
    invite,
    inviteUrl: absoluteUrl(`/planning-hub/join/redeem?token=${encodeURIComponent(rawToken)}`)
  } as const;
}

export async function revokePlanningWorkspaceInviteAction(inviteId: unknown) {
  const parsed = planningRecordIdSchema.safeParse(inviteId);
  if (!parsed.success) return { ok: false, message: "That invitation could not be found." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const { data, error } = await context.supabase
    .from("planning_workspace_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  return error || !data
    ? ({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure)
    : ({ ok: true } as const);
}

async function acceptPlanningWorkspaceInvite(rawToken: unknown) {
  const parsed = planningInviteTokenSchema.safeParse(rawToken);
  if (!parsed.success) return { ok: false, message: "This invitation link is not valid." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  if (!context.user.email || !context.user.email_confirmed_at) {
    return { ok: false, message: "Confirm your email address before accepting this invitation." } satisfies ActionFailure;
  }

  const { data: workspaceId, error } = await context.supabase.rpc(
    "accept_planning_workspace_invite",
    { raw_token: parsed.data }
  );

  return error || !workspaceId
    ? ({ ok: false, message: "This invitation is invalid, expired, already used, or belongs to another email address." } satisfies ActionFailure)
    : ({ ok: true, workspaceId } as const);
}

export async function acceptPlanningWorkspaceInviteFromCookieAction(
  _previousState: PlanningInviteAcceptanceState,
  _formData: FormData
): Promise<PlanningInviteAcceptanceState> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(PLANNING_INVITE_COOKIE)?.value;
  if (!rawToken) {
    return {
      status: "error",
      message: "Open the original invitation link again before accepting."
    };
  }

  const result = await acceptPlanningWorkspaceInvite(rawToken);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  cookieStore.set(PLANNING_INVITE_COOKIE, "", {
    ...planningInviteCookieOptions(),
    expires: new Date(0),
    maxAge: 0
  });
  return {
    status: "success",
    message: "You now have secure partner access to this wedding plan.",
    workspaceId: result.workspaceId
  };
}

async function deletePlanningRecord(
  table: "planning_tasks" | "planning_guests" | "planning_tables" | "planning_seating_rules",
  recordId: unknown
) {
  const parsed = planningRecordIdSchema.safeParse(recordId);
  if (!parsed.success) return { ok: false, message: "That planning item could not be found." } satisfies ActionFailure;
  const context = await getPlanningContext();
  if (!context.ok) return context;

  const { error, count } = await context.supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("id", parsed.data);

  return error || count !== 1
    ? ({ ok: false, message: SAVE_FAILED_MESSAGE } satisfies ActionFailure)
    : ({ ok: true } as const);
}
