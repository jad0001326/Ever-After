import { describe, expect, it, vi } from "vitest";
import { syncPlanningTablePlan } from "./table-plan-api";

describe("syncPlanningTablePlan", () => {
  it("passes the caller's exact workspace version to the atomic RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: [{ workspace_updated_at: "2026-07-29T12:00:00.001Z" }],
      error: null,
    }));
    const plan = tablePlan();

    const result = await syncPlanningTablePlan(
      { rpc } as never,
      "60000000-0000-4000-8000-000000000006",
      plan,
      "2026-07-29T12:00:00.000Z",
    );

    expect(result).toEqual({
      ok: true,
      workspaceId: "60000000-0000-4000-8000-000000000006",
      savedAt: "2026-07-29T12:00:00.001Z",
    });
    expect(rpc).toHaveBeenCalledWith("sync_planning_table_plan", {
      target_workspace_id: "60000000-0000-4000-8000-000000000006",
      table_plan: plan,
      expected_updated_at: "2026-07-29T12:00:00.000Z",
    });
  });

  it("maps the RPC serialization failure to a version conflict", async () => {
    const result = await syncPlanningTablePlan(
      {
        rpc: vi.fn(async () => ({
          data: null,
          error: { code: "40001", message: "changed" },
        })),
      } as never,
      "60000000-0000-4000-8000-000000000006",
      tablePlan(),
      "2026-07-29T12:00:00.000Z",
    );

    expect(result).toEqual({ ok: false, reason: "version_conflict" });
  });

  it("keeps non-conflict Data API failures generic", async () => {
    const result = await syncPlanningTablePlan(
      {
        rpc: vi.fn(async () => ({
          data: null,
          error: { code: "42501", message: "permission denied" },
        })),
      } as never,
      "60000000-0000-4000-8000-000000000006",
      tablePlan(),
      "2026-07-29T12:00:00.000Z",
    );

    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});

function tablePlan() {
  return {
    schemaVersion: 1 as const,
    id: "table-plan-1",
    name: "Our tables",
    guests: [],
    tables: [],
    rules: [],
    updatedAt: "2026-07-29T12:01:00.000Z",
  };
}
