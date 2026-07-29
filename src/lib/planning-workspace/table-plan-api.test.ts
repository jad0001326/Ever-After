import { describe, expect, it, vi } from "vitest";
import {
  loadPlanningTablePlan,
  syncPlanningTablePlan,
} from "./table-plan-api";

describe("syncPlanningTablePlan", () => {
  it("loads only bounded RLS-visible table-plan records in stable order", async () => {
    const queries = tablePlanQueries();
    const result = await loadPlanningTablePlan(
      {
        from: vi.fn((table: string) => (
          queries[table as keyof typeof queries]
        )),
      } as never,
      "60000000-0000-4000-8000-000000000006",
    );

    expect(result).toEqual({
      ok: true,
      resource: tablePlanResource(),
    });
    expect(queries.planning_guests.limit).toHaveBeenCalledWith(1001);
    expect(queries.planning_tables.limit).toHaveBeenCalledWith(201);
    expect(queries.planning_seats.limit).toHaveBeenCalledWith(1001);
    expect(queries.planning_seating_rules.limit).toHaveBeenCalledWith(2001);
    expect(queries.planning_guests.order).toHaveBeenNthCalledWith(
      1,
      "sort_order",
    );
    expect(queries.planning_guests.order).toHaveBeenNthCalledWith(2, "name");
  });

  it("distinguishes an inaccessible workspace, query failure and oversized state", async () => {
    const missing = tablePlanQueries();
    missing.planning_workspaces.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    const failed = tablePlanQueries();
    failed.planning_guests.limit.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const oversized = tablePlanQueries();
    oversized.planning_tables.limit.mockResolvedValue({
      data: Array.from({ length: 201 }, (_, index) => ({
        id: `table-${index}`,
      })),
      error: null,
    });

    await expect(loadPlanningTablePlan(
      { from: vi.fn((table: string) => (
        missing[table as keyof typeof missing]
      )) } as never,
      "60000000-0000-4000-8000-000000000006",
    )).resolves.toEqual({ ok: false, reason: "not_found" });
    await expect(loadPlanningTablePlan(
      { from: vi.fn((table: string) => (
        failed[table as keyof typeof failed]
      )) } as never,
      "60000000-0000-4000-8000-000000000006",
    )).resolves.toEqual({ ok: false, reason: "unavailable" });
    await expect(loadPlanningTablePlan(
      { from: vi.fn((table: string) => (
        oversized[table as keyof typeof oversized]
      )) } as never,
      "60000000-0000-4000-8000-000000000006",
    )).resolves.toEqual({ ok: false, reason: "invalid" });
  });

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

function tablePlanQueries() {
  return {
    planning_workspaces: singleQuery({
      data: {
        id: "60000000-0000-4000-8000-000000000006",
        name: "Our wedding plan",
        updated_at: "2026-07-29T12:00:00.000Z",
      },
      error: null,
    }),
    planning_guests: collectionQuery({
      data: [{
        id: "80000000-0000-4000-8000-000000000008",
        name: "Ailsa",
        email: "ailsa@example.com",
        rsvp_status: "accepted",
        dietary_notes: "Vegetarian",
        sort_order: 0,
      }],
      error: null,
    }),
    planning_tables: collectionQuery({
      data: [{
        id: "90000000-0000-4000-8000-000000000009",
        name: "Top table",
        capacity: 8,
        locked: false,
        sort_order: 0,
      }],
      error: null,
    }),
    planning_seats: collectionQuery({
      data: [{
        guest_id: "80000000-0000-4000-8000-000000000008",
        table_id: "90000000-0000-4000-8000-000000000009",
        seat_index: 0,
      }],
      error: null,
    }),
    planning_seating_rules: collectionQuery({
      data: [],
      error: null,
    }),
  };
}

function singleQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function collectionQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return query;
}

function tablePlanResource() {
  return {
    schemaVersion: 1,
    workspaceId: "60000000-0000-4000-8000-000000000006",
    workspaceUpdatedAt: "2026-07-29T12:00:00.000Z",
    tablePlan: {
      schemaVersion: 1,
      id: "60000000-0000-4000-8000-000000000006",
      name: "Our wedding plan",
      guests: [{
        id: "80000000-0000-4000-8000-000000000008",
        name: "Ailsa",
        email: "ailsa@example.com",
        rsvpStatus: "accepted",
        dietaryNotes: "Vegetarian",
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
      updatedAt: "2026-07-29T12:00:00.000Z",
    },
  };
}
