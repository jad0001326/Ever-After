import type { PlanningWorkspaceImportRequest } from "@everaft/planning-contracts/planning-workspace/connection-api-schema";

import type { DevicePlanData } from "./device-plan-model";

export function createDevicePlanImportRequest(
  data: DevicePlanData,
): PlanningWorkspaceImportRequest {
  const tablePlan = data.workspace.tablePlan;
  return {
    schemaVersion: 1,
    snapshot: {
      id: data.workspace.id,
      budgetPlanId: data.budgetPlan.id,
      name: data.workspace.name,
      profile: data.workspace.profile,
      tasks: data.workspace.tasks,
      guests: tablePlan.guests.map((guest) => ({
        id: guest.id,
        name: guest.name,
        email: guest.email ?? null,
        rsvpStatus: guest.rsvpStatus ?? "pending",
        dietaryNotes: guest.dietaryNotes ?? null,
      })),
      tables: tablePlan.tables,
      seats: tablePlan.guests.flatMap((guest) => (
        guest.tableId !== null && guest.seatIndex !== null
          ? [{ guestId: guest.id, tableId: guest.tableId, seatIndex: guest.seatIndex }]
          : []
      )),
      rules: tablePlan.rules,
    },
    budgetPlan: data.budgetPlan,
    targetWorkspaceId: null,
    expectedWorkspaceUpdatedAt: null,
  };
}
