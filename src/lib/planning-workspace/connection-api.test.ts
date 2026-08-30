import { describe, expect, it, vi } from "vitest";

import {
  importPlanningWorkspaceConnection,
  updatePlanningWorkspaceSetup,
} from "./connection-api";

describe("planning workspace connection RPC boundary", () => {
  it("assigns the authenticated owner and advances the imported budget version", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ workspace_id: "60000000-0000-4000-8000-000000000006" }],
      error: null,
    });
    const request = importRequest();

    const result = await importPlanningWorkspaceConnection(
      { rpc } as never,
      "70000000-0000-4000-8000-000000000007",
      request as never,
      new Date("2026-08-27T09:00:00.000Z"),
    );

    expect(result).toEqual({
      ok: true,
      workspaceId: "60000000-0000-4000-8000-000000000006",
    });
    const [, args] = rpc.mock.calls[0];
    expect(args.budget_plan.userId).toBe("70000000-0000-4000-8000-000000000007");
    expect(args.budget_plan.updatedAt).toBe("2026-08-27T09:00:00.000Z");
  });

  it.each([
    ["P4090", "conflict"],
    ["23505", "conflict"],
    ["P0002", "not_found"],
    ["42501", "not_found"],
    ["22023", "invalid"],
    ["54000", "too_large"],
    ["XX000", "unavailable"],
  ])("maps database code %s to a non-disclosing API reason", async (code, reason) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code } });
    await expect(importPlanningWorkspaceConnection(
      { rpc } as never,
      "70000000-0000-4000-8000-000000000007",
      importRequest() as never,
    )).resolves.toEqual({ ok: false, reason });
  });

  it("passes all three expected versions to the atomic setup function", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        workspace_updated_at: "2026-08-27T09:00:00.001Z",
        budget_updated_at: "2026-08-27T09:00:00.001Z",
        profile_updated_at: "2026-08-27T09:00:00.001Z",
      }],
      error: null,
    });
    const result = await updatePlanningWorkspaceSetup(
      { rpc } as never,
      "60000000-0000-4000-8000-000000000006",
      setupRequest() as never,
    );
    expect(result).toMatchObject({ ok: true });
    expect(rpc).toHaveBeenCalledWith("update_planning_workspace_setup_v1", expect.objectContaining({
      expected_workspace_updated_at: "2026-08-27T08:00:00.000Z",
      expected_budget_updated_at: "2026-08-27T08:00:00.000Z",
      expected_profile_updated_at: null,
    }));
  });
});

function importRequest() {
  return {
    snapshot: { budgetPlanId: "budget-1" },
    budgetPlan: { id: "budget-1", userId: null, updatedAt: "2026-08-27T08:00:00.000Z" },
    targetWorkspaceId: null,
    expectedWorkspaceUpdatedAt: null,
  };
}

function setupRequest() {
  return {
    expectedVersions: {
      workspaceUpdatedAt: "2026-08-27T08:00:00.000Z",
      budgetUpdatedAt: "2026-08-27T08:00:00.000Z",
      profileUpdatedAt: null,
    },
    setup: {
      totalBudgetPence: 2_500_000,
      profile: {
        weddingDate: "2027-08-21",
        guestCount: 80,
        location: "Edinburgh",
        dateFlexibility: "fixed",
        locationFlexible: false,
        priorities: ["venue", "photography"],
        venueStyles: ["Castle"],
        photographyStyles: ["Documentary"],
        vision: null,
      },
    },
  };
}
