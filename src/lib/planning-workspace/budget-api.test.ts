import { describe, expect, it, vi } from "vitest";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import { updatePlanningBudgetPlan } from "./budget-api";

describe("updatePlanningBudgetPlan", () => {
  it("updates only the linked owner row at the exact expected version", async () => {
    const expectedUpdatedAt = "2026-07-29T12:00:00.000Z";
    const query = updateQuery({
      data: { updated_at: "2026-07-29T12:00:00.001+00:00" },
      error: null,
    });
    const from = vi.fn(() => query);
    const plan = {
      ...createPlanningHubStarterPlan("partner-1"),
      id: "budget-1",
      updatedAt: expectedUpdatedAt,
      totalBudgetPence: 3_000_000,
    };

    const result = await updatePlanningBudgetPlan(
      { from } as never,
      "owner-1",
      plan,
      expectedUpdatedAt,
      new Date(expectedUpdatedAt),
    );

    expect(result).toEqual({
      ok: true,
      budgetPlanId: "budget-1",
      savedAt: "2026-07-29T12:00:00.001Z",
    });
    expect(from).toHaveBeenCalledWith("budget_plans");
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      total_budget_pence: 3_000_000,
      updated_at: "2026-07-29T12:00:00.001Z",
      plan_json: expect.objectContaining({
        id: "budget-1",
        userId: "owner-1",
        updatedAt: "2026-07-29T12:00:00.001Z",
      }),
    }));
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("user_id");
    expect(query.eq).toHaveBeenCalledWith("user_id", "owner-1");
    expect(query.eq).toHaveBeenCalledWith("id", "budget-1");
    expect(query.eq).toHaveBeenCalledWith(
      "updated_at",
      expectedUpdatedAt,
    );
  });

  it("reports a zero-row conditional update as a version conflict", async () => {
    const query = updateQuery({ data: null, error: null });
    const plan = {
      ...createPlanningHubStarterPlan("owner-1"),
      id: "budget-1",
    };

    const result = await updatePlanningBudgetPlan(
      { from: vi.fn(() => query) } as never,
      "owner-1",
      plan,
      plan.updatedAt,
    );

    expect(result).toEqual({ ok: false, reason: "version_conflict" });
  });

  it("keeps Data API errors distinct from optimistic conflicts", async () => {
    const query = updateQuery({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const plan = {
      ...createPlanningHubStarterPlan("owner-1"),
      id: "budget-1",
    };

    const result = await updatePlanningBudgetPlan(
      { from: vi.fn(() => query) } as never,
      "owner-1",
      plan,
      plan.updatedAt,
    );

    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });
});

function updateQuery(result: { data: unknown; error: unknown }) {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}
