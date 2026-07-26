import type { Database } from "@/types/database";
import type { PlanningWorkspace } from "./types";
import { createEmptyPlanningWorkspace } from "./workspace";

type PlanningWorkspaceRow = Database["public"]["Tables"]["planning_workspaces"]["Row"];
type PlanningTaskRow = Database["public"]["Tables"]["planning_tasks"]["Row"];
type PlanningGuestRow = Database["public"]["Tables"]["planning_guests"]["Row"];
type PlanningTableRow = Database["public"]["Tables"]["planning_tables"]["Row"];
type PlanningSeatRow = Database["public"]["Tables"]["planning_seats"]["Row"];
type PlanningSeatingRuleRow = Database["public"]["Tables"]["planning_seating_rules"]["Row"];

export type PlanningWorkspaceCloudSnapshot = {
  workspace: PlanningWorkspaceRow;
  tasks: PlanningTaskRow[];
  guests: PlanningGuestRow[];
  tables: PlanningTableRow[];
  seats: PlanningSeatRow[];
  seatingRules: PlanningSeatingRuleRow[];
};

export type PlanningWorkspaceStartupMode =
  | "device_only"
  | "cloud_loaded"
  | "device_ahead"
  | "review_required";

export type PlanningWorkspaceStartup = {
  workspace: PlanningWorkspace;
  mode: PlanningWorkspaceStartupMode;
};

function latestTimestamp(snapshot: PlanningWorkspaceCloudSnapshot) {
  const timestamps = [
    snapshot.workspace.updated_at,
    ...snapshot.tasks.map((task) => task.updated_at),
    ...snapshot.guests.map((guest) => guest.updated_at),
    ...snapshot.tables.map((table) => table.updated_at),
    ...snapshot.seats.map((seat) => seat.updated_at),
  ];
  return timestamps.reduce((latest, value) => value > latest ? value : latest);
}

export function planningWorkspaceFromCloud(
  snapshot: PlanningWorkspaceCloudSnapshot,
): PlanningWorkspace {
  const seatsByGuest = new Map(
    snapshot.seats.map((seat) => [seat.guest_id, seat]),
  );

  return {
    schemaVersion: 1,
    id: snapshot.workspace.id,
    cloudWorkspaceId: snapshot.workspace.id,
    ownerId: snapshot.workspace.owner_id,
    budgetPlanId: snapshot.workspace.budget_plan_id ?? "",
    name: snapshot.workspace.name,
    tasks: snapshot.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      notes: task.notes,
      category: task.category,
      status: task.status,
      dueDate: task.due_date,
      sortOrder: task.sort_order,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    })),
    tablePlan: {
      schemaVersion: 1,
      id: snapshot.workspace.id,
      name: `${snapshot.workspace.name} table plan`,
      guests: snapshot.guests.map((guest) => {
        const seat = seatsByGuest.get(guest.id);
        return {
          id: guest.id,
          name: guest.name,
          tableId: seat?.table_id ?? null,
          seatIndex: seat?.seat_index ?? null,
        };
      }),
      tables: snapshot.tables.map((table) => ({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        locked: table.locked,
      })),
      rules: snapshot.seatingRules.map((rule) => ({
        id: rule.id,
        personAId: rule.person_a_id,
        personBId: rule.person_b_id,
        type: rule.rule_type,
      })),
      updatedAt: latestTimestamp(snapshot),
    },
    createdAt: snapshot.workspace.created_at,
    updatedAt: latestTimestamp(snapshot),
  };
}

export function hasMeaningfulPlanningWorkspaceContent(workspace: PlanningWorkspace) {
  if (
    workspace.tasks.length > 0
    || workspace.tablePlan.guests.length > 0
    || workspace.tablePlan.rules.length > 0
  ) {
    return true;
  }

  const defaultTables = [
    { name: "Top table", capacity: 8, locked: false },
    { name: "Table 2", capacity: 8, locked: false },
    { name: "Table 3", capacity: 8, locked: false },
  ];
  return workspace.tablePlan.tables.length !== defaultTables.length
    || workspace.tablePlan.tables.some((table, index) => {
      const expected = defaultTables[index];
      return !expected
        || table.name !== expected.name
        || table.capacity !== expected.capacity
        || table.locked !== expected.locked;
    });
}

export function resolvePlanningWorkspaceStartup({
  cloudEnabled,
  cloudSnapshot,
  deviceWorkspace,
  ownerId,
  budgetPlanId,
}: {
  cloudEnabled: boolean;
  cloudSnapshot: PlanningWorkspaceCloudSnapshot | null;
  deviceWorkspace: PlanningWorkspace | null;
  ownerId: string | null;
  budgetPlanId: string;
}): PlanningWorkspaceStartup {
  const validDeviceWorkspace = deviceWorkspace?.budgetPlanId === budgetPlanId
    ? { ...deviceWorkspace, ownerId: ownerId ?? deviceWorkspace.ownerId }
    : null;

  if (!cloudEnabled || !cloudSnapshot) {
    return {
      workspace: validDeviceWorkspace ?? createEmptyPlanningWorkspace({ ownerId, budgetPlanId }),
      mode: "device_only",
    };
  }

  const cloudWorkspace = planningWorkspaceFromCloud(cloudSnapshot);
  if (!validDeviceWorkspace || !hasMeaningfulPlanningWorkspaceContent(validDeviceWorkspace)) {
    return { workspace: cloudWorkspace, mode: "cloud_loaded" };
  }

  if (validDeviceWorkspace.cloudWorkspaceId !== cloudWorkspace.id) {
    return { workspace: validDeviceWorkspace, mode: "review_required" };
  }

  return validDeviceWorkspace.updatedAt > cloudWorkspace.updatedAt
    ? { workspace: validDeviceWorkspace, mode: "device_ahead" }
    : { workspace: cloudWorkspace, mode: "cloud_loaded" };
}
