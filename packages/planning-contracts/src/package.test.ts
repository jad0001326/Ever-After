import { describe, expect, it } from "vitest";
import { planningTaskCreateRequestSchema } from "./planning-workspace/task-api-schema";
import { planningTablePlanUpdateRequestSchema } from "./planning-workspace/table-plan-api-schema";
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

  it("rejects a new table-plan write that leaves a declined guest seated", () => {
    expect(planningTablePlanUpdateRequestSchema.safeParse({
      schemaVersion: 1,
      expectedWorkspaceUpdatedAt: "2026-09-01T10:00:00.000Z",
      tablePlan: {
        schemaVersion: 1,
        id: "60000000-0000-4000-8000-000000000006",
        name: "Our wedding",
        guests: [{
          id: "80000000-0000-4000-8000-000000000008",
          name: "Ailsa",
          rsvpStatus: "declined",
          tableId: "90000000-0000-4000-8000-000000000009",
          seatIndex: 0,
        }],
        tables: [{
          id: "90000000-0000-4000-8000-000000000009",
          name: "Top table",
          capacity: 8,
          locked: false,
        }],
        rules: [],
        updatedAt: "2026-09-01T10:00:00.000Z",
      },
    }).success).toBe(false);
  });
});
