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
});
