import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BUDGET_STORAGE_KEY, serializeBudgetPlan } from "@/lib/budget/persistence";
import { addManualPlanningHubSupplier, createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import { PlanningHubSupplierRoadmap } from "./planning-hub-supplier-roadmap";

describe("PlanningHubSupplierRoadmap", () => {
  beforeEach(() => window.localStorage.clear());

  it("distinguishes live catalogue discovery from truthful manual planning", () => {
    render(
      <PlanningHubSupplierRoadmap
        connectedWorkspaceId={null}
        initialPlan={createPlanningHubStarterPlan(null)}
      />,
    );

    expect(screen.getByRole("link", { name: /Browse & compare/i }).getAttribute("href"))
      .toBe("/planning-hub/photography");
    expect(screen.getAllByText("Manual planning").length).toBeGreaterThan(1);
    expect(screen.getAllByRole("link", { name: /Add manually/i })[0].getAttribute("href"))
      .toContain("#manual-videographer");
  });

  it("shows the latest manual supplier and preserves the shared workspace", () => {
    const plan = addManualPlanningHubSupplier(
      createPlanningHubStarterPlan(null),
      "florist",
      "Heather & Stem",
      120_000,
      "quoted",
    );
    render(
      <PlanningHubSupplierRoadmap
        connectedWorkspaceId="60000000-0000-4000-8000-000000000006"
        initialPlan={plan}
      />,
    );

    expect(screen.getByText("Heather & Stem")).toBeTruthy();
    expect(screen.getByText(/quoted.*£1,200/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Continue planning/i }).getAttribute("href"))
      .toBe(`/planning-hub/suppliers/florist?workspace=60000000-0000-4000-8000-000000000006&planItem=${plan.items[0].id}#current-supplier-planning`);
  });

  it("restores a device plan when the server only supplied a newer empty fallback", async () => {
    const devicePlan = addManualPlanningHubSupplier(
      createPlanningHubStarterPlan(null),
      "florist",
      "Heather & Stem",
      120_000,
      "quoted",
    );
    devicePlan.updatedAt = "2026-07-28T10:00:00.000Z";
    window.localStorage.setItem(BUDGET_STORAGE_KEY, serializeBudgetPlan(devicePlan));
    const newerFallback = {
      ...createPlanningHubStarterPlan(null),
      updatedAt: "2026-07-28T11:00:00.000Z",
    };

    render(
      <PlanningHubSupplierRoadmap
        connectedWorkspaceId={null}
        initialPlan={newerFallback}
        initialPlanIsFallback
      />,
    );

    await waitFor(() => expect(screen.getByText("Heather & Stem")).toBeTruthy());
  });
});
