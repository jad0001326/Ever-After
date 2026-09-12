import type { PlanningWorkspaceHydration } from "@everaft/api-client";
import type { PlanningTask } from "@everaft/planning-domain/planning-workspace/types";

import { createDevicePlan, type DevicePlanData } from "./device-plan-model";
import {
  acceptCloudResources,
  listPendingPlanningResources,
  pendingResourcesMatchCloud,
} from "./conflict-recovery";

const accountId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const pendingTaskId = "33333333-3333-4333-8333-333333333333";
const unaffectedTaskId = "44444444-4444-4444-8444-444444444444";

describe("connected planning conflict recovery", () => {
  it("reports only resource kinds without private plan content", () => {
    const local = localConflictPlan();

    expect(listPendingPlanningResources(local)).toEqual(["budget", "table_plan", "tasks"]);
  });

  it("accepts only conflicted cloud resources and preserves device identity and discovery", () => {
    const local = localConflictPlan();
    const hydration = cloudHydration();

    const accepted = acceptCloudResources(local, hydration, { accountId, workspaceId });

    expect(accepted.connectedSync).toEqual({
      lastConnected: {
        accountId,
        workspaceId,
        budgetUpdatedAt: hydration.budget.versions.budgetUpdatedAt,
        workspaceUpdatedAt: hydration.tablePlan.workspaceUpdatedAt,
      },
      pendingBudget: null,
      pendingTablePlan: null,
      pendingTasks: [],
    });
    expect(accepted.budgetPlan.totalBudgetPence).toBe(5_000_000);
    expect(accepted.budgetPlan.userId).toBe(local.budgetPlan.userId);
    expect(accepted.budgetPlan.createdAt).toBe(local.budgetPlan.createdAt);
    expect(accepted.workspace.tablePlan).toEqual(hydration.tablePlan.tablePlan);
    expect(accepted.workspace.tasks.map((task) => [task.id, task.title])).toEqual([
      [pendingTaskId, "Cloud task title"],
    ]);
    expect(accepted.discovery).toBe(local.discovery);
    expect(accepted.localPreferences).toBe(local.localPreferences);
  });

  it("persists the full canonical task collection when the cloud copy is selected", () => {
    const local = localConflictPlan();
    const hydration = cloudHydration();
    const withoutPendingCloudTask = {
      ...hydration,
      tasks: { ...hydration.tasks, tasks: [] },
    };

    const accepted = acceptCloudResources(
      local,
      withoutPendingCloudTask,
      { accountId, workspaceId },
    );

    expect(accepted.workspace.tasks).toEqual([]);
  });

  it("confirms every pending resource before a device copy is acknowledged", () => {
    const local = localConflictPlan();
    const cloud = cloudHydration();
    expect(pendingResourcesMatchCloud(local, cloud)).toBe(false);

    const matching = {
      ...cloud,
      budget: { ...cloud.budget, plan: { ...local.budgetPlan, userId: accountId } },
      tablePlan: { ...cloud.tablePlan, tablePlan: local.workspace.tablePlan },
      tasks: {
        ...cloud.tasks,
        tasks: [{ schemaVersion: 1 as const, workspaceId, ...task(pendingTaskId, "Device task title") }],
      },
    };
    expect(pendingResourcesMatchCloud(local, matching)).toBe(true);
  });
});

function localConflictPlan(): DevicePlanData {
  const created = createDevicePlan({
    weddingDate: null,
    location: "Scotland",
    guestCount: 80,
    totalBudgetPence: 3_000_000,
    priorities: [],
    weddingSeason: "Summer",
  }, new Date("2026-09-01T10:00:00.000Z"));
  return {
    ...created,
    discovery: { ...created.discovery, savedVenueIds: ["venue-1"] },
    connectedSync: {
      lastConnected: {
        accountId,
        workspaceId,
        budgetUpdatedAt: "2026-09-02T10:00:00.000Z",
        workspaceUpdatedAt: "2026-09-02T10:00:00.000Z",
      },
      pendingBudget: {
        accountId,
        workspaceId,
        baseBudgetUpdatedAt: "2026-09-02T10:00:00.000Z",
      },
      pendingTablePlan: {
        accountId,
        workspaceId,
        baseWorkspaceUpdatedAt: "2026-09-02T10:00:00.000Z",
      },
      pendingTasks: [{
        kind: "update" as const,
        accountId,
        workspaceId,
        taskId: pendingTaskId,
        baseTaskUpdatedAt: "2026-09-02T10:00:00.000Z",
      }],
    },
    workspace: {
      ...created.workspace,
      tasks: [
        task(pendingTaskId, "Device task title"),
        task(unaffectedTaskId, "Keep local unaffected task"),
      ],
    },
  } satisfies DevicePlanData;
}

function cloudHydration(): PlanningWorkspaceHydration {
  const local = localConflictPlan();
  return {
    dashboard: {} as PlanningWorkspaceHydration["dashboard"],
    budget: {
      schemaVersion: 1,
      workspaceId,
      plan: { ...local.budgetPlan, totalBudgetPence: 5_000_000 },
      versions: { workspaceUpdatedAt: "2026-09-03T10:00:00.000Z", budgetUpdatedAt: "2026-09-03T10:00:00.000Z" },
    },
    profile: { schemaVersion: 1, workspaceId, profile: local.workspace.profile },
    tasks: { schemaVersion: 1, workspaceId, tasks: [{
      schemaVersion: 1,
      workspaceId,
      ...task(pendingTaskId, "Cloud task title"),
    }], page: { limit: 100, offset: 0, hasMore: false } },
    tablePlan: {
      schemaVersion: 1,
      workspaceId,
      workspaceUpdatedAt: "2026-09-03T10:00:00.000Z",
      tablePlan: { ...local.workspace.tablePlan, updatedAt: "2026-09-03T10:00:00.000Z" },
    },
  };
}

function task(id: string, title: string): PlanningTask {
  return {
    id,
    title,
    category: "general",
    status: "todo",
    dueDate: null,
    notes: null,
    sortOrder: 0,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-02T10:00:00.000Z",
  };
}
