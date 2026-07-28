import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPlanningTaskAction,
  syncPlanningTablePlanAction,
} from "@/app/actions/planning-workspace";
import {
  BUDGET_STORAGE_KEY,
  createEmptyBudgetPlan,
} from "@/lib/budget/persistence";
import {
  createEmptyPlanningWorkspace,
  PLANNING_WORKSPACE_STORAGE_KEY,
  serializePlanningWorkspace,
} from "@/lib/planning-workspace/workspace";
import { PlanningHubOrganiseWorkspace } from "./planning-hub-organise-workspace";

vi.mock("@/app/actions/planning-workspace", () => ({
  createPlanningTaskAction: vi.fn(async () => ({ ok: true })),
  updatePlanningTaskAction: vi.fn(async () => ({ ok: true })),
  saveConnectedBudgetPlanAction: vi.fn(async () => ({ ok: true })),
  savePlanningWorkspaceProfileAction: vi.fn(async () => ({ ok: true })),
  syncPlanningTablePlanAction: vi.fn(async () => ({
    ok: true,
    updatedAt: "2026-07-26T11:00:00.000Z",
  })),
  createPlanningWorkspaceInviteAction: vi.fn(async () => ({ ok: false, message: "Not used" })),
  revokePlanningWorkspaceInviteAction: vi.fn(async () => ({ ok: false, message: "Not used" })),
}));

describe("PlanningHubOrganiseWorkspace", () => {
  beforeEach(() => window.localStorage.clear());

  it("connects the next recommendation to the current budget plan", async () => {
    render(<PlanningHubOrganiseWorkspace initialBudgetPlan={createEmptyBudgetPlan()} userId={null} />);

    expect(await screen.findByText("Choose the venue direction")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue planning" }).getAttribute("href")).toBe("/planning-hub");
    expect(screen.queryByRole("button", { name: /Review.*cloud/i })).toBeNull();
  });

  it("keeps recommendations and profile discovery inside a shared workspace", async () => {
    render(
      <PlanningHubOrganiseWorkspace
        connectedWorkspaceId="60000000-0000-4000-8000-000000000006"
        initialBudgetPlan={createEmptyBudgetPlan()}
        userId={null}
      />,
    );

    expect((await screen.findByRole("link", { name: "Continue planning" })).getAttribute("href"))
      .toBe("/planning-hub?workspace=60000000-0000-4000-8000-000000000006");
    expect(screen.getByRole("link", { name: "Find matching venues" }).getAttribute("href"))
      .toBe("/planning-hub?workspace=60000000-0000-4000-8000-000000000006");
  });

  it("adds tasks and persists them inside the same local workspace", async () => {
    render(<PlanningHubOrganiseWorkspace initialBudgetPlan={createEmptyBudgetPlan()} userId="user-1" />);
    await screen.findByText("Your tasks");

    fireEvent.change(screen.getByPlaceholderText("e.g. Confirm final venue numbers"), {
      target: { value: "Confirm caterer numbers" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(screen.getByText("Confirm caterer numbers")).toBeTruthy();
    await waitFor(() => {
      expect(window.localStorage.getItem(PLANNING_WORKSPACE_STORAGE_KEY)).toContain("Confirm caterer numbers");
    });
  });

  it("keeps profile basics in the existing budget plan and connected workspace", async () => {
    const budgetPlan = createEmptyBudgetPlan();
    render(<PlanningHubOrganiseWorkspace initialBudgetPlan={budgetPlan} userId={null} />);
    await screen.findByText("Help EverAft narrow the choices");

    fireEvent.change(screen.getByLabelText("Total wedding budget"), { target: { value: "24000" } });
    fireEvent.change(screen.getByLabelText("Estimated guests"), { target: { value: "84" } });
    fireEvent.change(screen.getByLabelText("Preferred area"), { target: { value: "Fife" } });
    fireEvent.click(screen.getByText("Photography"));
    fireEvent.click(screen.getByRole("button", { name: "Save wedding profile" }));

    await waitFor(() => {
      const storedBudget = JSON.parse(window.localStorage.getItem(BUDGET_STORAGE_KEY) ?? "{}");
      const storedWorkspace = JSON.parse(window.localStorage.getItem(PLANNING_WORKSPACE_STORAGE_KEY) ?? "{}");
      expect(storedBudget).toMatchObject({
        id: budgetPlan.id,
        totalBudgetPence: 2_400_000,
        guestCount: 84,
        location: "Fife",
      });
      expect(storedWorkspace.profile).toMatchObject({
        guestCount: 84,
        location: "Fife",
        priorities: ["photography"],
      });
    });
  });

  it("restores a newer guest plan when the server starter has a new id", async () => {
    const initialPlan = {
      ...createEmptyBudgetPlan(),
      updatedAt: "2026-07-26T10:00:00.000Z",
    };
    const localPlan = {
      ...createEmptyBudgetPlan(),
      location: "Perthshire",
      guestCount: 72,
      totalBudgetPence: 1_800_000,
      updatedAt: "2026-07-27T10:00:00.000Z",
    };
    const localWorkspace = createEmptyPlanningWorkspace({
      budgetPlanId: localPlan.id,
      ownerId: null,
    });
    localWorkspace.profile = {
      ...localWorkspace.profile,
      location: "Perthshire",
      guestCount: 72,
      updatedAt: localPlan.updatedAt,
    };
    window.localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(localPlan));
    window.localStorage.setItem(
      PLANNING_WORKSPACE_STORAGE_KEY,
      serializePlanningWorkspace(localWorkspace),
    );

    render(<PlanningHubOrganiseWorkspace initialBudgetPlan={initialPlan} userId={null} />);

    expect((await screen.findByRole("link", { name: "Find matching venues" })).getAttribute("href"))
      .toBe("/planning-hub?location=Perthshire&guests=72&budget=18000");
  });

  it("defers the full seating editor until the couple opens it", async () => {
    render(<PlanningHubOrganiseWorkspace initialBudgetPlan={createEmptyBudgetPlan()} userId={null} />);
    await screen.findByText("Open the table editor when you need it");

    expect(screen.queryByText("Plan health")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open guest & table planner" }));
    expect(await screen.findByText("Plan health")).toBeTruthy();
  });

  it("writes a connected task through workspace RLS while retaining its device copy", async () => {
    const budgetPlan = { ...createEmptyBudgetPlan("owner-1"), id: "budget-1" };
    render(
      <PlanningHubOrganiseWorkspace
        cloudEnabled
        connectedWorkspaceId="60000000-0000-4000-8000-000000000006"
        initialBudgetPlan={budgetPlan}
        initialCloudSnapshot={{
          workspace: {
            id: "60000000-0000-4000-8000-000000000006",
            owner_id: "owner-1",
            budget_plan_id: "budget-1",
            name: "Shared wedding plan",
            created_at: "2026-07-26T10:00:00.000Z",
            updated_at: "2026-07-26T10:00:00.000Z",
          },
          profile: null,
          members: [],
          invites: [],
          tasks: [],
          guests: [],
          tables: [],
          seats: [],
          seatingRules: [],
        }}
        userId="partner-1"
      />,
    );
    await screen.findByText("Your tasks");
    fireEvent.change(screen.getByPlaceholderText("e.g. Confirm final venue numbers"), {
      target: { value: "Confirm shared numbers" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await waitFor(() => expect(createPlanningTaskAction).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "60000000-0000-4000-8000-000000000006",
      title: "Confirm shared numbers",
    })));
    expect(screen.getByText("Confirm shared numbers")).toBeTruthy();
  });

  it("debounces a connected table-plan change into one atomic sync", async () => {
    const budgetPlan = { ...createEmptyBudgetPlan("owner-1"), id: "budget-1" };
    render(
      <PlanningHubOrganiseWorkspace
        cloudEnabled
        connectedWorkspaceId="60000000-0000-4000-8000-000000000006"
        initialBudgetPlan={budgetPlan}
        initialCloudSnapshot={{
          workspace: {
            id: "60000000-0000-4000-8000-000000000006",
            owner_id: "owner-1",
            budget_plan_id: "budget-1",
            name: "Shared wedding plan",
            created_at: "2026-07-26T10:00:00.000Z",
            updated_at: "2026-07-26T10:00:00.000Z",
          },
          profile: null,
          members: [],
          invites: [],
          tasks: [],
          guests: [],
          tables: [],
          seats: [],
          seatingRules: [],
        }}
        userId="partner-1"
      />,
    );
    await screen.findByText("Open the table editor when you need it");
    fireEvent.click(screen.getByRole("button", { name: "Open guest & table planner" }));
    fireEvent.click(await screen.findByRole("button", { name: "Try an example" }));

    await waitFor(() => expect(syncPlanningTablePlanAction).toHaveBeenCalledWith(
      "60000000-0000-4000-8000-000000000006",
      expect.objectContaining({
        guests: expect.arrayContaining([expect.objectContaining({ name: "Amy Fraser" })]),
      }),
      "2026-07-26T10:00:00.000Z",
    ), { timeout: 2500 });
    expect(await screen.findByText("Guest and table changes saved to the shared plan.")).toBeTruthy();
  });
});
