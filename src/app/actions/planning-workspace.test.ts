import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import {
  importPlanningWorkspaceSnapshotAction,
  saveConnectedBudgetPlanAction,
} from "./planning-workspace";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const validSnapshot = {
  id: "60000000-0000-4000-8000-000000000006",
  budgetPlanId: "budget-1",
  name: "Our wedding plan",
  profile: {
    schemaVersion: 1 as const,
    weddingDate: null,
    guestCount: null,
    location: null,
    dateFlexibility: "not_set" as const,
    locationFlexible: false,
    priorities: [],
    venueStyles: [],
    photographyStyles: [],
    vision: null,
    updatedAt: "2026-07-26T10:00:00.000Z",
  },
  tasks: [],
  guests: [],
  tables: [{
    id: "90000000-0000-4000-8000-000000000009",
    name: "Top table",
    capacity: 8,
    locked: false,
  }],
  seats: [],
  rules: [],
};

describe("planning workspace server actions", () => {
  const previousCloudFlag = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;

  afterEach(() => {
    vi.mocked(createClient).mockReset();
    if (previousCloudFlag === undefined) {
      delete process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;
    } else {
      process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = previousCloudFlag;
    }
  });

  it("does not create a Supabase client when connected planning is disabled", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "false";

    const result = await importPlanningWorkspaceSnapshotAction({
      snapshot: validSnapshot,
      targetWorkspaceId: null,
      expectedUpdatedAt: null,
    });

    expect(result).toEqual({
      ok: false,
      message: "Connected planning is still in private testing. Your current plan remains saved on this device.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a budget that is not linked to the requested workspace", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
    const workspaceQuery = chain({
      data: { owner_id: "owner-1", budget_plan_id: "different-budget" },
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "partner-1" } }, error: null })) },
      from: vi.fn(() => workspaceQuery),
    } as never);

    const result = await saveConnectedBudgetPlanAction(
      "60000000-0000-4000-8000-000000000006",
      createPlanningHubStarterPlan("owner-1"),
    );

    expect(result).toEqual({
      ok: false,
      message: "That budget does not belong to this connected workspace.",
    });
  });

  it("updates only the owner and plan linked to an accessible workspace", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
    const plan = { ...createPlanningHubStarterPlan("owner-1"), id: "budget-1" };
    const workspaceQuery = chain({
      data: { owner_id: "owner-1", budget_plan_id: "budget-1" },
      error: null,
    });
    const budgetQuery = chain({
      data: { updated_at: "2026-07-26T20:00:00.000Z" },
      error: null,
    });
    const from = vi.fn((table: string) => (
      table === "planning_workspaces" ? workspaceQuery : budgetQuery
    ));
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "partner-1" } }, error: null })) },
      from,
    } as never);

    const result = await saveConnectedBudgetPlanAction(
      "60000000-0000-4000-8000-000000000006",
      plan,
    );

    expect(result.ok).toBe(true);
    expect(budgetQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      name: plan.name,
      plan_json: expect.objectContaining({ id: "budget-1", userId: "owner-1" }),
    }));
    expect(budgetQuery.eq).toHaveBeenCalledWith("user_id", "owner-1");
    expect(budgetQuery.eq).toHaveBeenCalledWith("id", "budget-1");
  });
});

function chain(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}
