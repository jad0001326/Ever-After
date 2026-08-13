import { describe, expect, it, vi } from "vitest";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import {
  loadPlanningWorkspaceContext,
  loadPlanningWorkspaceVersion,
} from "./server-snapshot";

const workspaceId = "60000000-0000-4000-8000-000000000006";
const ownerId = "10000000-0000-4000-8000-000000000001";

describe("loadPlanningWorkspaceContext", () => {
  it("loads only the RLS-visible workspace version for narrow mutations", async () => {
    const workspaceQuery = query({
      data: {
        id: workspaceId,
        updated_at: "2026-07-29T12:00:00.000Z",
      },
      error: null,
    });
    const from = vi.fn(() => workspaceQuery);

    const result = await loadPlanningWorkspaceVersion(
      { from } as never,
      workspaceId,
    );

    expect(result).toEqual({
      ok: true,
      workspaceId,
      updatedAt: "2026-07-29T12:00:00.000Z",
    });
    expect(workspaceQuery.select).toHaveBeenCalledWith("id, updated_at");
    expect(workspaceQuery.eq).toHaveBeenCalledWith("id", workspaceId);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("loads an RLS-visible workspace and its exact owner budget", async () => {
    const plan = {
      ...createPlanningHubStarterPlan(ownerId),
      id: "budget-1",
    };
    const queries = new Map<string, ReturnType<typeof query>>();
    queries.set("planning_workspaces", query({
      data: {
        id: workspaceId,
        owner_id: ownerId,
        budget_plan_id: plan.id,
        name: "Our wedding plan",
        created_at: "2026-07-29T10:00:00.000Z",
        updated_at: "2026-07-29T10:00:00.000Z",
      },
      error: null,
    }));
    queries.set("planning_workspace_profiles", query({
      data: null,
      error: null,
    }));
    queries.set("budget_plans", query({
      data: { plan_json: plan },
      error: null,
    }));
    const emptyTables = [
      "planning_tasks",
      "planning_guests",
      "planning_tables",
      "planning_seats",
      "planning_seating_rules",
    ];
    for (const table of emptyTables) {
      queries.set(table, query({ data: [], error: null }));
    }
    const from = vi.fn((table: string) => queries.get(table));

    const result = await loadPlanningWorkspaceContext(
      { from } as never,
      workspaceId,
      "partner-1",
      { includeSharing: false },
    );

    expect(result).toMatchObject({
      ok: true,
      isOwner: false,
      budgetPlan: {
        id: "budget-1",
        userId: ownerId,
      },
      snapshot: {
        workspace: {
          id: workspaceId,
          owner_id: ownerId,
        },
      },
    });
    const budgetQuery = queries.get("budget_plans");
    expect(budgetQuery?.eq).toHaveBeenCalledWith("user_id", ownerId);
    expect(budgetQuery?.eq).toHaveBeenCalledWith("id", "budget-1");
    expect(from).not.toHaveBeenCalledWith("planning_workspace_members");
    expect(from).not.toHaveBeenCalledWith("planning_workspace_invites");
  });

  it("stops without querying a budget when RLS hides the workspace", async () => {
    const from = vi.fn((table: string) => query(
      table === "planning_workspaces"
        ? { data: null, error: null }
        : { data: [], error: null },
    ));

    const result = await loadPlanningWorkspaceContext(
      { from } as never,
      workspaceId,
      "outsider-1",
    );

    expect(result).toEqual({
      ok: false,
      message: "That connected plan is unavailable or you no longer have access.",
    });
    expect(from).not.toHaveBeenCalledWith("budget_plans");
  });
});

function query(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(async () => result),
    then: (
      resolve: (value: typeof result) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  return chain;
}
