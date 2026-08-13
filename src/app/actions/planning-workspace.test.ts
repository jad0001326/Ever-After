import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import {
  createPlanningTaskAction,
  deletePlanningTaskAction,
  importPlanningWorkspaceSnapshotAction,
  savePlanningWorkspaceProfileAction,
  saveConnectedBudgetPlanAction,
  syncPlanningTablePlanAction,
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

  it("keeps the optimistic task id when writing to a shared workspace", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
    const taskQuery = chain({ data: { id: "70000000-0000-4000-8000-000000000007" }, error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "partner-1" } }, error: null })) },
      from: vi.fn(() => taskQuery),
    } as never);

    const result = await createPlanningTaskAction({
      id: "70000000-0000-4000-8000-000000000007",
      workspaceId: "60000000-0000-4000-8000-000000000006",
      title: "Confirm final numbers",
    });

    expect(result.ok).toBe(true);
    expect(taskQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      id: "70000000-0000-4000-8000-000000000007",
      workspace_id: "60000000-0000-4000-8000-000000000006",
    }));
  });

  it("deletes exactly one validated task through workspace RLS", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
    const eq = vi.fn(async () => ({ error: null, count: 1 }));
    const remove = vi.fn(() => ({ eq }));
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "partner-1" } }, error: null })) },
      from: vi.fn(() => ({ delete: remove })),
    } as never);

    const result = await deletePlanningTaskAction(
      "70000000-0000-4000-8000-000000000007",
    );

    expect(result).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith({ count: "exact" });
    expect(eq).toHaveBeenCalledWith(
      "id",
      "70000000-0000-4000-8000-000000000007",
    );
  });

  it("upserts a validated profile through workspace RLS", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
    const profileQuery = chain({ data: { workspace_id: "60000000-0000-4000-8000-000000000006" }, error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "partner-1" } }, error: null })) },
      from: vi.fn(() => profileQuery),
    } as never);

    const result = await savePlanningWorkspaceProfileAction(
      "60000000-0000-4000-8000-000000000006",
      validSnapshot.profile,
    );

    expect(result.ok).toBe(true);
    expect(profileQuery.upsert).toHaveBeenCalledWith(expect.objectContaining({
      location_flexible: false,
      priorities: [],
    }), { onConflict: "workspace_id" });
  });

  it("sends a validated table plan through the atomic sync function", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
    const rpc = vi.fn(async () => ({
      data: [{ workspace_updated_at: "2026-07-26T21:00:00.000Z" }],
      error: null,
    }));
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "partner-1" } }, error: null })) },
      rpc,
    } as never);
    const tablePlan = {
      schemaVersion: 1 as const,
      id: "table-plan-1",
      name: "Our tables",
      guests: [{
        id: "80000000-0000-4000-8000-000000000008",
        name: "Ailsa",
        tableId: "90000000-0000-4000-8000-000000000009",
        seatIndex: 0,
      }],
      tables: [{
        id: "90000000-0000-4000-8000-000000000009",
        name: "Top table",
        capacity: 8,
        locked: false,
      }],
      rules: [],
      updatedAt: "2026-07-26T20:59:00.000Z",
    };

    const result = await syncPlanningTablePlanAction(
      "60000000-0000-4000-8000-000000000006",
      tablePlan,
      "2026-07-26T20:00:00.000Z",
    );

    expect(result).toEqual({ ok: true, updatedAt: "2026-07-26T21:00:00.000Z" });
    expect(rpc).toHaveBeenCalledWith("sync_planning_table_plan", {
      target_workspace_id: "60000000-0000-4000-8000-000000000006",
      table_plan: tablePlan,
      expected_updated_at: "2026-07-26T20:00:00.000Z",
    });
  });
});

function chain(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.upsert.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}
