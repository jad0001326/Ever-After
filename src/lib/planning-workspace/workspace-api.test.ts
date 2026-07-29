import { describe, expect, it, vi } from "vitest";
import { listPlanningWorkspaces } from "./workspace-api";

const userId = "70000000-0000-4000-8000-000000000007";
const firstWorkspaceId = "60000000-0000-4000-8000-000000000006";
const secondWorkspaceId = "80000000-0000-4000-8000-000000000008";

describe("Planning Workspace API persistence", () => {
  it("returns an ordered bounded page with only the caller's roles", async () => {
    const workspaceQuery = listQuery({
      data: [
        workspaceRow(),
        workspaceRow({
          id: secondWorkspaceId,
          name: "Second plan",
          budget_plan_id: null,
        }),
      ],
      error: null,
    });
    const membershipQuery = membershipListQuery({
      data: [{ workspace_id: firstWorkspaceId, role: "partner" }],
      error: null,
    });
    const from = vi.fn((table: string) => (
      table === "planning_workspaces" ? workspaceQuery : membershipQuery
    ));

    const result = await listPlanningWorkspaces(
      { from } as never,
      userId,
      20,
      1,
    );

    expect(result).toEqual({
      ok: true,
      workspaces: [workspaceResource()],
      hasMore: true,
    });
    expect(workspaceQuery.order).toHaveBeenNthCalledWith(
      1,
      "updated_at",
      { ascending: false },
    );
    expect(workspaceQuery.order).toHaveBeenNthCalledWith(2, "id");
    expect(workspaceQuery.range).toHaveBeenCalledWith(20, 21);
    expect(membershipQuery.eq).toHaveBeenCalledWith("user_id", userId);
    expect(membershipQuery.in).toHaveBeenCalledWith(
      "workspace_id",
      [firstWorkspaceId],
    );
  });

  it("does not query membership rows for an empty page", async () => {
    const workspaceQuery = listQuery({ data: [], error: null });
    const from = vi.fn(() => workspaceQuery);

    await expect(listPlanningWorkspaces(
      { from } as never,
      userId,
      0,
      25,
    )).resolves.toEqual({
      ok: true,
      workspaces: [],
      hasMore: false,
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the caller role is absent or duplicated", async () => {
    const missing = await runWithMembershipRows([]);
    const duplicate = await runWithMembershipRows([
      { workspace_id: firstWorkspaceId, role: "owner" },
      { workspace_id: firstWorkspaceId, role: "partner" },
    ]);

    expect(missing).toEqual({ ok: false, reason: "invalid_result" });
    expect(duplicate).toEqual({ ok: false, reason: "invalid_result" });
  });

  it("maps either Data API query failure to unavailable", async () => {
    const workspaceFailure = listQuery({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    await expect(listPlanningWorkspaces(
      { from: vi.fn(() => workspaceFailure) } as never,
      userId,
      0,
      25,
    )).resolves.toEqual({ ok: false, reason: "unavailable" });

    const membershipFailure = await runWithMembershipRows(
      null,
      { code: "42501", message: "permission denied" },
    );
    expect(membershipFailure).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

async function runWithMembershipRows(
  data: unknown,
  error: unknown = null,
) {
  const workspaceQuery = listQuery({
    data: [workspaceRow()],
    error: null,
  });
  const membershipQuery = membershipListQuery({ data, error });
  return listPlanningWorkspaces(
    {
      from: vi.fn((table: string) => (
        table === "planning_workspaces" ? workspaceQuery : membershipQuery
      )),
    } as never,
    userId,
    0,
    25,
  );
}

function listQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    range: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return query;
}

function membershipListQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function workspaceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: firstWorkspaceId,
    name: "Ailsa and Rowan",
    budget_plan_id: "budget-1",
    created_at: "2026-07-29T11:00:00.000Z",
    updated_at: "2026-07-29T12:00:00.000Z",
    ...overrides,
  };
}

function workspaceResource() {
  return {
    schemaVersion: 1 as const,
    id: firstWorkspaceId,
    name: "Ailsa and Rowan",
    budgetPlanId: "budget-1",
    role: "partner" as const,
    createdAt: "2026-07-29T11:00:00.000Z",
    updatedAt: "2026-07-29T12:00:00.000Z",
  };
}
