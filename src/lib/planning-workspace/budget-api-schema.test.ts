import { describe, expect, it } from "vitest";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import {
  planningBudgetUpdateRequestJsonSchema,
  planningBudgetUpdateRequestSchema,
  planningBudgetUpdateSuccessJsonSchema,
  planningBudgetUpdateSuccessSchema,
} from "./budget-api-schema";
import checkedRequestSchema from "../../../docs/planning-hub/contracts/planning-budget-update-request.v1.schema.json";
import checkedSuccessSchema from "../../../docs/planning-hub/contracts/planning-budget-update-success.v1.schema.json";

describe("Planning Budget API contracts", () => {
  it("accepts a strict conflict-safe budget update request", () => {
    const plan = {
      ...createPlanningHubStarterPlan("owner-1"),
      id: "budget-1",
    };
    const request = {
      schemaVersion: 1,
      expectedBudgetUpdatedAt: plan.updatedAt,
      plan,
    };

    expect(planningBudgetUpdateRequestSchema.parse(request)).toEqual(request);
  });

  it("rejects unknown request fields and invalid versions", () => {
    const plan = {
      ...createPlanningHubStarterPlan("owner-1"),
      id: "budget-1",
    };

    expect(planningBudgetUpdateRequestSchema.safeParse({
      schemaVersion: 1,
      expectedBudgetUpdatedAt: "yesterday",
      plan,
    }).success).toBe(false);
    expect(planningBudgetUpdateRequestSchema.safeParse({
      schemaVersion: 1,
      expectedBudgetUpdatedAt: plan.updatedAt,
      plan,
      force: true,
    }).success).toBe(false);
  });

  it("accepts only the versioned success response", () => {
    const success = {
      schemaVersion: 1,
      budgetPlanId: "budget-1",
      savedAt: "2026-07-29T12:00:00.001Z",
    };

    expect(planningBudgetUpdateSuccessSchema.parse(success)).toEqual(success);
    expect(planningBudgetUpdateSuccessSchema.safeParse({
      ...success,
      ownerId: "owner-1",
    }).success).toBe(false);
  });

  it("keeps both checked language-neutral schemas current", () => {
    expect(checkedRequestSchema).toEqual(
      planningBudgetUpdateRequestJsonSchema,
    );
    expect(checkedSuccessSchema).toEqual(
      planningBudgetUpdateSuccessJsonSchema,
    );
    expect(checkedRequestSchema).toMatchObject({
      $id: "urn:everaft:planning-budget-update-request:v1",
      additionalProperties: false,
    });
    expect(checkedSuccessSchema).toMatchObject({
      $id: "urn:everaft:planning-budget-update-success:v1",
      additionalProperties: false,
    });
  });
});
