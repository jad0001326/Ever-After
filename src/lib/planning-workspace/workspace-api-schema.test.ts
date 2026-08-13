import { describe, expect, it } from "vitest";
import checkedCollection from "../../../docs/planning-hub/contracts/planning-workspace-collection.v1.schema.json";
import {
  planningWorkspaceCollectionJsonSchema,
  planningWorkspaceCollectionSchema,
  planningWorkspaceResourceSchema,
} from "./workspace-api-schema";

describe("Planning Workspace API contracts", () => {
  it("accepts strict resources and bounded collection pages", () => {
    const workspace = workspaceResource();
    const collection = {
      schemaVersion: 1,
      workspaces: [workspace],
      page: { limit: 25, offset: 0, hasMore: false },
    };

    expect(planningWorkspaceResourceSchema.parse(workspace)).toEqual(workspace);
    expect(planningWorkspaceCollectionSchema.parse(collection)).toEqual(
      collection,
    );
    expect(planningWorkspaceCollectionSchema.safeParse({
      ...collection,
      page: { ...collection.page, limit: 51 },
    }).success).toBe(false);
  });

  it("rejects identity disclosure and unknown role fields", () => {
    const workspace = workspaceResource();

    expect(planningWorkspaceResourceSchema.safeParse({
      ...workspace,
      ownerId: "70000000-0000-4000-8000-000000000007",
    }).success).toBe(false);
    expect(planningWorkspaceResourceSchema.safeParse({
      ...workspace,
      role: "viewer",
    }).success).toBe(false);
  });

  it("keeps the checked language-neutral collection schema current", () => {
    expect(checkedCollection).toEqual(
      planningWorkspaceCollectionJsonSchema,
    );
    expect(checkedCollection).toMatchObject({
      $id: "urn:everaft:planning-workspace-collection:v1",
      additionalProperties: false,
    });
  });
});

function workspaceResource() {
  return {
    schemaVersion: 1 as const,
    id: "60000000-0000-4000-8000-000000000006",
    name: "Ailsa and Rowan",
    budgetPlanId: "budget-1",
    role: "partner" as const,
    createdAt: "2026-07-29T11:00:00.000Z",
    updatedAt: "2026-07-29T12:00:00.000Z",
  };
}
