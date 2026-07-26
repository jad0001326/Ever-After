import { describe, expect, it } from "vitest";
import type { PlanningWorkspaceCloudSnapshot } from "./cloud";
import {
  planningWorkspaceFromCloud,
  resolvePlanningWorkspaceStartup,
} from "./cloud";
import {
  createEmptyPlanningWorkspace,
  createPlanningTask,
} from "./workspace";

const cloudSnapshot: PlanningWorkspaceCloudSnapshot = {
  workspace: {
    id: "60000000-0000-4000-8000-000000000006",
    owner_id: "30000000-0000-4000-8000-000000000003",
    budget_plan_id: "budget-1",
    name: "Our wedding plan",
    created_at: "2026-07-26T10:00:00.000Z",
    updated_at: "2026-07-26T10:05:00.000Z",
  },
  tasks: [{
    id: "70000000-0000-4000-8000-000000000007",
    workspace_id: "60000000-0000-4000-8000-000000000006",
    title: "Confirm guest count",
    notes: null,
    category: "guests",
    status: "in_progress",
    due_date: null,
    sort_order: 0,
    created_at: "2026-07-26T10:01:00.000Z",
    updated_at: "2026-07-26T10:06:00.000Z",
  }],
  guests: [{
    id: "80000000-0000-4000-8000-000000000008",
    workspace_id: "60000000-0000-4000-8000-000000000006",
    name: "Ailsa Grant",
    email: null,
    rsvp_status: "pending",
    dietary_notes: null,
    sort_order: 0,
    created_at: "2026-07-26T10:02:00.000Z",
    updated_at: "2026-07-26T10:02:00.000Z",
  }],
  tables: [{
    id: "90000000-0000-4000-8000-000000000009",
    workspace_id: "60000000-0000-4000-8000-000000000006",
    name: "Top table",
    capacity: 8,
    locked: false,
    sort_order: 0,
    created_at: "2026-07-26T10:03:00.000Z",
    updated_at: "2026-07-26T10:03:00.000Z",
  }],
  seats: [{
    workspace_id: "60000000-0000-4000-8000-000000000006",
    guest_id: "80000000-0000-4000-8000-000000000008",
    table_id: "90000000-0000-4000-8000-000000000009",
    seat_index: 0,
    created_at: "2026-07-26T10:04:00.000Z",
    updated_at: "2026-07-26T10:04:00.000Z",
  }],
  seatingRules: [],
};

describe("planning workspace cloud adapter", () => {
  it("maps normalized cloud rows back into the reusable workspace model", () => {
    const workspace = planningWorkspaceFromCloud(cloudSnapshot);

    expect(workspace.cloudWorkspaceId).toBe(cloudSnapshot.workspace.id);
    expect(workspace.tasks[0].title).toBe("Confirm guest count");
    expect(workspace.tablePlan.guests[0]).toMatchObject({
      name: "Ailsa Grant",
      tableId: cloudSnapshot.tables[0].id,
      seatIndex: 0,
    });
    expect(workspace.updatedAt).toBe("2026-07-26T10:06:00.000Z");
  });

  it("does not inspect or replace the device workspace while cloud is disabled", () => {
    const deviceWorkspace = createEmptyPlanningWorkspace({
      ownerId: null,
      budgetPlanId: "budget-1",
    });
    deviceWorkspace.tasks = [createPlanningTask("Keep this device task")];

    const result = resolvePlanningWorkspaceStartup({
      cloudEnabled: false,
      cloudSnapshot,
      deviceWorkspace,
      ownerId: "30000000-0000-4000-8000-000000000003",
      budgetPlanId: "budget-1",
    });

    expect(result.mode).toBe("device_only");
    expect(result.workspace.tasks[0].title).toBe("Keep this device task");
  });

  it("keeps an unlinked device plan instead of silently overwriting it", () => {
    const deviceWorkspace = createEmptyPlanningWorkspace({
      ownerId: null,
      budgetPlanId: "budget-1",
    });
    deviceWorkspace.tasks = [createPlanningTask("Unsynced task")];

    const result = resolvePlanningWorkspaceStartup({
      cloudEnabled: true,
      cloudSnapshot,
      deviceWorkspace,
      ownerId: "30000000-0000-4000-8000-000000000003",
      budgetPlanId: "budget-1",
    });

    expect(result.mode).toBe("review_required");
    expect(result.workspace.tasks[0].title).toBe("Unsynced task");
  });

  it("loads a cloud plan when the device has no meaningful planning work", () => {
    const result = resolvePlanningWorkspaceStartup({
      cloudEnabled: true,
      cloudSnapshot,
      deviceWorkspace: createEmptyPlanningWorkspace({
        ownerId: null,
        budgetPlanId: "budget-1",
      }),
      ownerId: "30000000-0000-4000-8000-000000000003",
      budgetPlanId: "budget-1",
    });

    expect(result.mode).toBe("cloud_loaded");
    expect(result.workspace.tasks[0].title).toBe("Confirm guest count");
  });
});
