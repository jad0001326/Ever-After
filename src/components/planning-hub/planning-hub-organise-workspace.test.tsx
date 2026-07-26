import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import { PLANNING_WORKSPACE_STORAGE_KEY } from "@/lib/planning-workspace/workspace";
import { PlanningHubOrganiseWorkspace } from "./planning-hub-organise-workspace";

describe("PlanningHubOrganiseWorkspace", () => {
  beforeEach(() => window.localStorage.clear());

  it("connects the next recommendation to the current budget plan", async () => {
    render(<PlanningHubOrganiseWorkspace initialBudgetPlan={createEmptyBudgetPlan()} userId={null} />);

    expect(await screen.findByText("Choose the venue direction")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue planning" }).getAttribute("href")).toBe("/planning-hub");
    expect(screen.queryByRole("button", { name: /Review.*cloud/i })).toBeNull();
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

  it("defers the full seating editor until the couple opens it", async () => {
    render(<PlanningHubOrganiseWorkspace initialBudgetPlan={createEmptyBudgetPlan()} userId={null} />);
    await screen.findByText("Open the table editor when you need it");

    expect(screen.queryByText("Plan health")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open guest & table planner" }));
    expect(await screen.findByText("Plan health")).toBeTruthy();
  });
});
