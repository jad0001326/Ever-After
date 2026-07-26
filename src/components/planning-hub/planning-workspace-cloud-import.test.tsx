import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import type { PlanningWorkspaceCloudSnapshot } from "@/lib/planning-workspace/cloud";
import {
  createEmptyPlanningWorkspace,
  createPlanningTask,
  PLANNING_WORKSPACE_BACKUP_STORAGE_KEY,
} from "@/lib/planning-workspace/workspace";
import { PlanningWorkspaceCloudImport } from "./planning-workspace-cloud-import";

const cloudSnapshot: PlanningWorkspaceCloudSnapshot = {
  workspace: {
    id: "60000000-0000-4000-8000-000000000006",
    owner_id: "30000000-0000-4000-8000-000000000003",
    budget_plan_id: "budget-1",
    name: "Cloud wedding plan",
    created_at: "2026-07-26T10:00:00.000Z",
    updated_at: "2026-07-26T10:05:00.000Z",
  },
  tasks: [],
  guests: [],
  tables: [],
  seats: [],
  seatingRules: [],
};

describe("PlanningWorkspaceCloudImport", () => {
  it("renders nothing while connected planning is disabled", () => {
    const workspace = createEmptyPlanningWorkspace({ ownerId: null, budgetPlanId: "budget-1" });
    const { container } = render(
      <PlanningWorkspaceCloudImport
        budgetPlan={createEmptyBudgetPlan()}
        cloudEnabled={false}
        cloudSnapshot={null}
        mode="device_only"
        onWorkspaceResolved={vi.fn()}
        userId="user-1"
        workspace={workspace}
      />,
    );

    expect(container.textContent).toBe("");
  });

  it("requires a review step before offering a cloud write", () => {
    const workspace = createEmptyPlanningWorkspace({ ownerId: null, budgetPlanId: "budget-1" });
    workspace.tasks = [createPlanningTask("Confirm final numbers")];
    render(
      <PlanningWorkspaceCloudImport
        budgetPlan={createEmptyBudgetPlan()}
        cloudEnabled
        cloudSnapshot={null}
        mode="device_only"
        onWorkspaceResolved={vi.fn()}
        userId="user-1"
        workspace={workspace}
      />,
    );

    expect(screen.queryByRole("button", { name: "Create cloud copy from this device" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Review secure cloud import" }));

    expect(screen.getByText(/1 tasks, 0 guests and 3 tables/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create cloud copy from this device" })).toBeTruthy();
  });

  it("backs up the device plan before choosing the cloud copy", () => {
    window.localStorage.clear();
    const workspace = createEmptyPlanningWorkspace({ ownerId: null, budgetPlanId: "budget-1" });
    workspace.tasks = [createPlanningTask("Device-only task")];
    const onWorkspaceResolved = vi.fn();
    render(
      <PlanningWorkspaceCloudImport
        budgetPlan={createEmptyBudgetPlan()}
        cloudEnabled
        cloudSnapshot={cloudSnapshot}
        mode="review_required"
        onWorkspaceResolved={onWorkspaceResolved}
        userId="user-1"
        workspace={workspace}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Review device and cloud copies" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep the cloud copy on this device" }));

    expect(window.localStorage.getItem(PLANNING_WORKSPACE_BACKUP_STORAGE_KEY)).toContain("Device-only task");
    expect(onWorkspaceResolved).toHaveBeenCalledWith(expect.objectContaining({
      cloudWorkspaceId: cloudSnapshot.workspace.id,
      name: "Cloud wedding plan",
    }));
  });
});
