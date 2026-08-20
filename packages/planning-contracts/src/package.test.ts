import { describe, expect, it } from "vitest";
import { planningTaskCreateRequestSchema } from "./planning-workspace/task-api-schema";
import { planningWorkspaceCollectionSchema } from "./planning-workspace/workspace-api-schema";

describe("planning-contracts package boundary", () => {
  it("exposes strict versioned task and workspace contracts", () => {
    expect(planningTaskCreateRequestSchema.safeParse({
      schemaVersion: 1,
      task: {
        title: "Confirm photographer",
        notes: null,
        category: "photography",
        status: "todo",
        dueDate: null,
        sortOrder: 0,
      },
    }).success).toBe(true);

    expect(planningWorkspaceCollectionSchema.safeParse({
      schemaVersion: 1,
      workspaces: [],
      page: { limit: 20, offset: 0, hasMore: false },
      unexpected: true,
    }).success).toBe(false);
  });
});
