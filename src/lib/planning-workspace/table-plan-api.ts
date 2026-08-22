import type { SupabaseClient } from "@supabase/supabase-js";
import type { TablePlan } from "@/lib/table-plan/types";
import type { Database, Json } from "@/types/database";

type PlanningSupabaseClient = SupabaseClient<Database>;

const TABLE_PLAN_LIMITS = {
  guests: 1000,
  tables: 200,
  seats: 1000,
  rules: 2000,
} as const;

export async function loadPlanningTablePlan(
  supabase: PlanningSupabaseClient,
  workspaceId: string,
) {
  const [workspace, guests, tables, seats, rules] = await Promise.all([
    supabase
      .from("planning_workspaces")
      .select("id, name, updated_at")
      .eq("id", workspaceId)
      .maybeSingle(),
    supabase
      .from("planning_guests")
      .select("id, name, email, rsvp_status, dietary_notes, sort_order")
      .eq("workspace_id", workspaceId)
      .order("sort_order")
      .order("name")
      .limit(TABLE_PLAN_LIMITS.guests + 1),
    supabase
      .from("planning_tables")
      .select("id, name, capacity, locked, sort_order")
      .eq("workspace_id", workspaceId)
      .order("sort_order")
      .order("created_at")
      .limit(TABLE_PLAN_LIMITS.tables + 1),
    supabase
      .from("planning_seats")
      .select("guest_id, table_id, seat_index")
      .eq("workspace_id", workspaceId)
      .limit(TABLE_PLAN_LIMITS.seats + 1),
    supabase
      .from("planning_seating_rules")
      .select("id, person_a_id, person_b_id, rule_type")
      .eq("workspace_id", workspaceId)
      .limit(TABLE_PLAN_LIMITS.rules + 1),
  ]);
  if (workspace.error) {
    return { ok: false, reason: "unavailable" } as const;
  }
  if (!workspace.data) {
    return { ok: false, reason: "not_found" } as const;
  }
  if (
    guests.error
    || tables.error
    || seats.error
    || rules.error
  ) {
    return { ok: false, reason: "unavailable" } as const;
  }
  if (
    (guests.data?.length ?? 0) > TABLE_PLAN_LIMITS.guests
    || (tables.data?.length ?? 0) > TABLE_PLAN_LIMITS.tables
    || (seats.data?.length ?? 0) > TABLE_PLAN_LIMITS.seats
    || (rules.data?.length ?? 0) > TABLE_PLAN_LIMITS.rules
  ) {
    return { ok: false, reason: "invalid" } as const;
  }

  const seatsByGuest = new Map(
    (seats.data ?? []).map((seat) => [seat.guest_id, seat]),
  );
  return {
    ok: true,
    resource: {
      schemaVersion: 1 as const,
      workspaceId: workspace.data.id,
      workspaceUpdatedAt: workspace.data.updated_at,
      tablePlan: {
        schemaVersion: 1 as const,
        id: workspace.data.id,
        name: workspace.data.name,
        guests: (guests.data ?? []).map((guest) => {
          const seat = seatsByGuest.get(guest.id);
          return {
            id: guest.id,
            name: guest.name,
            email: guest.email,
            rsvpStatus: guest.rsvp_status,
            dietaryNotes: guest.dietary_notes,
            tableId: seat?.table_id ?? null,
            seatIndex: seat?.seat_index ?? null,
          };
        }),
        tables: (tables.data ?? []).map((table) => ({
          id: table.id,
          name: table.name,
          capacity: table.capacity,
          locked: table.locked,
        })),
        rules: (rules.data ?? []).map((rule) => ({
          id: rule.id,
          personAId: rule.person_a_id,
          personBId: rule.person_b_id,
          type: rule.rule_type,
        })),
        updatedAt: workspace.data.updated_at,
      },
    },
  } as const;
}

export async function syncPlanningTablePlan(
  supabase: PlanningSupabaseClient,
  workspaceId: string,
  tablePlan: TablePlan,
  expectedWorkspaceUpdatedAt: string,
) {
  const { data, error } = await supabase.rpc("sync_planning_table_plan_v2", {
    target_workspace_id: workspaceId,
    table_plan: tablePlan as unknown as Json,
    expected_updated_at: expectedWorkspaceUpdatedAt,
  });

  if (error?.code === "P4090") {
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
