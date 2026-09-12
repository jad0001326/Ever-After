import type { PlanningWorkspaceHydration } from "@everaft/api-client";

import type { DevicePlanData, LastConnectedPlanningScope } from "./device-plan-model";
import { taskContentMatches, taskResourceToDeviceTask } from "./task-reliability";
import { budgetPlanContentMatches } from "./payment-reliability";
import { tablePlanContentMatches } from "./table-plan-reliability";

export type PendingPlanningResource = "budget" | "table_plan" | "tasks";

export function listPendingPlanningResources(
  data: DevicePlanData,
): PendingPlanningResource[] {
  return [
    ...(data.connectedSync.pendingBudget ? ["budget" as const] : []),
    ...(data.connectedSync.pendingTablePlan ? ["table_plan" as const] : []),
    ...(data.connectedSync.pendingTasks.length > 0 ? ["tasks" as const] : []),
  ];
}
export function acceptCloudResources(
  local: DevicePlanData,
  hydration: PlanningWorkspaceHydration,
  scope: Readonly<Pick<LastConnectedPlanningScope, "accountId" | "workspaceId">>,
): DevicePlanData {
  return {
    ...local,
    connectedSync: {
      lastConnected: {
        accountId: scope.accountId,
        workspaceId: scope.workspaceId,
        budgetUpdatedAt: hydration.budget.versions.budgetUpdatedAt,
        workspaceUpdatedAt: hydration.tablePlan.workspaceUpdatedAt,
      },
      pendingBudget: null,
      pendingTablePlan: null,
      pendingTasks: [],
    },
    budgetPlan: {
      ...hydration.budget.plan,
      userId: local.budgetPlan.userId,
      createdAt: local.budgetPlan.createdAt,
    },
    workspace: {
      ...local.workspace,
      budgetPlanId: hydration.budget.plan.id,
      name: hydration.dashboard.workspace?.name ?? local.workspace.name,
      profile: hydration.profile.profile ?? local.workspace.profile,
      tasks: hydration.tasks.tasks.map(taskResourceToDeviceTask),
      tablePlan: hydration.tablePlan.tablePlan,
      updatedAt: hydration.tablePlan.workspaceUpdatedAt,
    },
  };
}

export function pendingResourcesMatchCloud(
  local: DevicePlanData,
  hydration: PlanningWorkspaceHydration,
): boolean {
  if (local.connectedSync.pendingBudget
    && !budgetPlanContentMatches({
      ...local.budgetPlan,
      userId: hydration.budget.plan.userId,
      createdAt: hydration.budget.plan.createdAt,
    }, hydration.budget.plan)) {
    return false;
  }
  if (local.connectedSync.pendingTablePlan
    && !tablePlanContentMatches(local.workspace.tablePlan, hydration.tablePlan.tablePlan)) {
    return false;
  }
  return local.connectedSync.pendingTasks.every((operation) => {
    const intended = local.workspace.tasks.find((task) => task.id === operation.taskId);
    const cloud = hydration.tasks.tasks.find((task) => task.id === operation.taskId);
    if (operation.kind === "delete") return !cloud;
    return Boolean(intended && cloud && taskContentMatches(cloud, intended));
  });
}
