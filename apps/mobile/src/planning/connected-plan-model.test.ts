import { planningWorkspaceImportRequestSchema } from "@everaft/planning-contracts/planning-workspace/connection-api-schema";

import { createDevicePlanImportRequest } from "./connected-plan-model";
import { createDevicePlan } from "./device-plan-model";

describe("createDevicePlanImportRequest", () => {
  it("maps the complete device workspace into the strict atomic import contract", () => {
    const data = createDevicePlan({
      weddingDate: "2027-08-21",
      weddingSeason: null,
      location: "Edinburgh",
      guestCount: 80,
      totalBudgetPence: 2_500_000,
      priorities: ["venue", "photography"],
    }, new Date("2026-08-27T09:00:00.000Z"));

    const request = createDevicePlanImportRequest(data);

    expect(planningWorkspaceImportRequestSchema.parse(request)).toEqual(request);
    expect(request.snapshot.budgetPlanId).toBe(request.budgetPlan.id);
    expect(request.targetWorkspaceId).toBeNull();
    expect(request.expectedWorkspaceUpdatedAt).toBeNull();
  });

  it("does not import a stale seat for a declined guest", () => {
    const data = createDevicePlan({
      weddingDate: null,
      weddingSeason: null,
      location: null,
      guestCount: 80,
      totalBudgetPence: 2_000_000,
      priorities: [],
    });
    const seatedDecline = {
      ...data,
      workspace: {
        ...data.workspace,
        tablePlan: {
          ...data.workspace.tablePlan,
          guests: [{
            id: "80000000-0000-4000-8000-000000000008",
            name: "Ailsa",
            email: null,
            rsvpStatus: "declined" as const,
            dietaryNotes: null,
            tableId: data.workspace.tablePlan.tables[0].id,
            seatIndex: 0,
          }],
        },
      },
    };

    const request = createDevicePlanImportRequest(seatedDecline);

    expect(request.snapshot.guests[0].rsvpStatus).toBe("declined");
    expect(request.snapshot.seats).toEqual([]);
    expect(planningWorkspaceImportRequestSchema.parse(request)).toEqual(request);
  });
});
