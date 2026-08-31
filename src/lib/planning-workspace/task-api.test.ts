import { describe, expect, it, vi } from "vitest";
import {
  createPlanningTask,
  deletePlanningTask,
  listPlanningTasks,
  loadPlanningTask,
  updatePlanningTask,
} from "./task-api";

const workspaceId = "60000000-0000-4000-8000-000000000006";
const taskId = "70000000-0000-4000-8000-000000000007";
const updatedAt = "2026-07-29T12:00:00.000Z";

describe("Planning Task API persistence", () => {
  it("returns a bounded ordered page and detects one extra row", async () => {
    const query = listQuery({
      data: [taskRow(), taskRow({ id: "80000000-0000-4000-8000-000000000008" })],
      error: null,
    });

    const result = await listPlanningTasks(
      { from: vi.fn(() => query) } as never,
      workspaceId,
      20,
      1,
    );

    expect(result).toEqual({
      ok: true,
      tasks: [taskResource()],
      hasMore: true,
    });
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(query.order).toHaveBeenNthCalledWith(1, "sort_order");
    expect(query.order).toHaveBeenNthCalledWith(2, "created_at");
    expect(query.range).toHaveBeenCalledWith(20, 21);
  });

  it("loads one task only through its workspace and record identifiers", async () => {
    const query = terminalQuery({ data: taskRow(), error: null });

    const result = await loadPlanningTask(
      { from: vi.fn(() => query) } as never,
      workspaceId,
      taskId,
    );

    expect(result).toEqual({ ok: true, task: taskResource() });
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(query.eq).toHaveBeenCalledWith("id", taskId);
  });

  it("creates a task under the path workspace without client timestamps", async () => {
    const query = insertQuery({ data: taskRow(), error: null });

    const result = await createPlanningTask(
      { from: vi.fn(() => query) } as never,
      workspaceId,
      { id: taskId, ...taskContent() },
    );

    expect(result).toEqual({ ok: true, task: taskResource(), replayed: false });
    expect(query.insert).toHaveBeenCalledWith({
      id: taskId,
      workspace_id: workspaceId,
      title: "Confirm final guest numbers",
      notes: null,
      category: "guests",
      status: "todo",
      due_date: "2027-07-01",
      sort_order: 3,
    });
    expect(query.insert.mock.calls[0][0]).not.toHaveProperty("updated_at");
  });

  it("returns the existing task for an identical stable-ID replay", async () => {
    const insert = insertQuery({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });
    const load = terminalQuery({ data: taskRow(), error: null });
    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(insert)
        .mockReturnValueOnce(load),
    };

    await expect(createPlanningTask(
      supabase as never,
      workspaceId,
      { id: taskId, ...taskContent() },
    )).resolves.toEqual({ ok: true, task: taskResource(), replayed: true });
    expect(load.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(load.eq).toHaveBeenCalledWith("id", taskId);
  });

  it("keeps a stable-ID collision with different content as a conflict", async () => {
    const insert = insertQuery({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });
    const load = terminalQuery({ data: taskRow({ title: "Different task" }), error: null });

    await expect(createPlanningTask(
      { from: vi.fn().mockReturnValueOnce(insert).mockReturnValueOnce(load) } as never,
      workspaceId,
      { id: taskId, ...taskContent() },
    )).resolves.toEqual({ ok: false, reason: "version_conflict" });
  });

  it("updates only the exact task version within the path workspace", async () => {
    const query = updateQuery({
      data: taskRow({
        status: "done",
        updated_at: "2026-07-29T12:00:00.001Z",
      }),
      error: null,
    });

    const result = await updatePlanningTask(
      { from: vi.fn(() => query) } as never,
      workspaceId,
      taskId,
      { status: "done" },
      updatedAt,
    );

    expect(result).toEqual({
      ok: true,
      task: {
        ...taskResource(),
        status: "done",
        updatedAt: "2026-07-29T12:00:00.001Z",
      },
    });
    expect(query.update).toHaveBeenCalledWith({ status: "done" });
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(query.eq).toHaveBeenCalledWith("id", taskId);
    expect(query.eq).toHaveBeenCalledWith("updated_at", updatedAt);
  });

  it("maps zero-row updates and Data API errors separately", async () => {
    const conflict = updateQuery({ data: null, error: null });
    const failure = updateQuery({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });

    await expect(updatePlanningTask(
      { from: vi.fn(() => conflict) } as never,
      workspaceId,
      taskId,
      { status: "done" },
      updatedAt,
    )).resolves.toEqual({ ok: false, reason: "version_conflict" });
    await expect(updatePlanningTask(
      { from: vi.fn(() => failure) } as never,
      workspaceId,
      taskId,
      { status: "done" },
      updatedAt,
    )).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("deletes only the exact task version within the path workspace", async () => {
    const query = deleteQuery({ data: { id: taskId }, error: null });

    const result = await deletePlanningTask(
      { from: vi.fn(() => query) } as never,
      workspaceId,
      taskId,
      updatedAt,
    );

    expect(result).toEqual({ ok: true, taskId });
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(query.eq).toHaveBeenCalledWith("id", taskId);
    expect(query.eq).toHaveBeenCalledWith("updated_at", updatedAt);
    expect(query.select).toHaveBeenCalledWith("id");
  });

  it("maps a zero-row delete to a conflict", async () => {
    const query = deleteQuery({ data: null, error: null });

    await expect(deletePlanningTask(
      { from: vi.fn(() => query) } as never,
      workspaceId,
      taskId,
      updatedAt,
    )).resolves.toEqual({ ok: false, reason: "version_conflict" });
  });
});

function listQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return query;
}

function terminalQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function insertQuery(result: { data: unknown; error: unknown }) {
  const query = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(async () => result),
  };
  query.insert.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

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

function deleteQuery(result: { data: unknown; error: unknown }) {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

function taskContent() {
  return {
    title: "Confirm final guest numbers",
    notes: null,
    category: "guests" as const,
    status: "todo" as const,
    dueDate: "2027-07-01",
    sortOrder: 3,
  };
}

function taskResource() {
  return {
    schemaVersion: 1 as const,
    id: taskId,
    workspaceId,
    ...taskContent(),
    createdAt: "2026-07-29T11:00:00.000Z",
    updatedAt,
  };
}

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: taskId,
    workspace_id: workspaceId,
    title: "Confirm final guest numbers",
    notes: null,
    category: "guests",
    status: "todo",
    due_date: "2027-07-01",
    sort_order: 3,
    created_at: "2026-07-29T11:00:00.000Z",
    updated_at: updatedAt,
    ...overrides,
  };
}
