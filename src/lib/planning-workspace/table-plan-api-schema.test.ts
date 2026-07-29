import { describe, expect, it } from "vitest";
import {
  planningTablePlanUpdateRequestJsonSchema,
  planningTablePlanUpdateRequestSchema,
  planningTablePlanUpdateSuccessJsonSchema,
  planningTablePlanUpdateSuccessSchema,
} from "./table-plan-api-schema";
import checkedRequestSchema from "../../../docs/planning-hub/contracts/planning-table-plan-update-request.v1.schema.json";
import checkedSuccessSchema from "../../../docs/planning-hub/contracts/planning-table-plan-update-success.v1.schema.json";

describe("Planning Table Plan API contracts", () => {
  it("accepts a versioned table-plan update request", () => {
    const request = {
      schemaVersion: 1,
      expectedWorkspaceUpdatedAt: "2026-07-29T12:00:00.000Z",
      tablePlan: tablePlan(),
    };

    expect(planningTablePlanUpdateRequestSchema.parse(request)).toEqual(
      request,
    );
  });

  it("rejects unknown request fields and invalid seating", () => {
    expect(planningTablePlanUpdateRequestSchema.safeParse({
      schemaVersion: 1,
      expectedWorkspaceUpdatedAt: "2026-07-29T12:00:00.000Z",
      tablePlan: {
        ...tablePlan(),
        guests: [{
          id: "80000000-0000-4000-8000-000000000008",
          name: "Ailsa",
          tableId: null,
          seatIndex: 0,
        }],
      },
      overwrite: true,
    }).success).toBe(false);
  });

  it("accepts only the strict success version", () => {
    const success = {
      schemaVersion: 1,
      workspaceId: "60000000-0000-4000-8000-000000000006",
      savedAt: "2026-07-29T12:00:00.001Z",
    };

    expect(planningTablePlanUpdateSuccessSchema.parse(success)).toEqual(
      success,
    );
    expect(planningTablePlanUpdateSuccessSchema.safeParse({
      ...success,
      memberRole: "partner",
    }).success).toBe(false);
  });

  it("keeps both checked language-neutral schemas current", () => {
    expect(checkedRequestSchema).toEqual(
      planningTablePlanUpdateRequestJsonSchema,
    );
    expect(checkedSuccessSchema).toEqual(
      planningTablePlanUpdateSuccessJsonSchema,
    );
    expect(checkedRequestSchema).toMatchObject({
      $id: "urn:everaft:planning-table-plan-update-request:v1",
      additionalProperties: false,
    });
    expect(checkedSuccessSchema).toMatchObject({
      $id: "urn:everaft:planning-table-plan-update-success:v1",
      additionalProperties: false,
    });
  });
});

function tablePlan() {
  return {
    schemaVersion: 1 as const,
    id: "table-plan-1",
    name: "Our tables",
    guests: [],
    tables: [{
      id: "90000000-0000-4000-8000-000000000009",
      name: "Top table",
      capacity: 8,
      locked: false,
    }],
    rules: [],
    updatedAt: "2026-07-29T12:01:00.000Z",
  };
}
