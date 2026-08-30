import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
import {
  deletePlanningTask,
  loadPlanningTask,
  updatePlanningTask,
} from "@/lib/planning-workspace/task-api";
import {
  planningTaskDeleteSuccessSchema,
  planningTaskResourceSchema,
} from "@/lib/planning-workspace/task-api-schema";
import { loadPlanningWorkspaceVersion } from "@/lib/planning-workspace/server-snapshot";
import { DELETE, GET, PATCH } from "./route";

vi.mock("@/lib/planning-workspace/api-auth", () => ({
  authenticatePlanningApiRequest: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/server-snapshot", () => ({
  loadPlanningWorkspaceVersion: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/task-api", () => ({
  deletePlanningTask: vi.fn(),
  loadPlanningTask: vi.fn(),
  updatePlanningTask: vi.fn(),
}));

const workspaceId = "60000000-0000-4000-8000-000000000006";
const taskId = "70000000-0000-4000-8000-000000000007";
const updatedAt = "2026-07-29T12:00:00.000Z";

describe("Planning Task item API", () => {
  const previousCloudFlag = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;

  beforeEach(() => {
    enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceVersion).mockResolvedValue({
      ok: true,
      workspaceId,
      updatedAt: "2026-07-29T12:01:00.000Z",
    });
    vi.mocked(loadPlanningTask).mockResolvedValue({
      ok: true,
      task: taskResource(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (previousCloudFlag === undefined) {
      delete process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;
    } else {
      process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = previousCloudFlag;
    }
  });

  it("rejects invalid task identifiers before loading records", async () => {
    const response = await PATCH(
      patchRequest(validUpdate()),
      routeContext("not-a-uuid"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_task_id" });
    expect(loadPlanningWorkspaceVersion).not.toHaveBeenCalled();
    expect(loadPlanningTask).not.toHaveBeenCalled();
  });

  it("returns one strict task with no-store headers", async () => {
    const supabase = enableAuthenticatedRequest();
    const response = await GET(getRequest(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-everaft-contract")).toBe(
      "urn:everaft:planning-task-resource:v1",
    );
    expect(planningTaskResourceSchema.parse(body)).toEqual(body);
    expect(loadPlanningTask).toHaveBeenCalledWith(supabase, workspaceId, taskId);
  });

  it("keeps item reads RLS-safe and Data API failures generic", async () => {
    vi.mocked(loadPlanningTask).mockResolvedValueOnce({ ok: true, task: null });
    const missing = await GET(getRequest(), routeContext());
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "task_unavailable" });

    vi.mocked(loadPlanningTask).mockResolvedValueOnce({
      ok: false,
      reason: "unavailable",
    });
    const unavailable = await GET(getRequest(), routeContext());
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ error: "planning_api_unavailable" });
  });

  it("keeps workspace and task denial contracts distinct without cross-workspace lookup", async () => {
    vi.mocked(loadPlanningWorkspaceVersion).mockResolvedValueOnce({
      ok: false,
      message: "That connected plan is unavailable or you no longer have access.",
    });
    vi.mocked(loadPlanningTask).mockResolvedValueOnce({
      ok: true,
      task: null,
    });

    const workspaceDenied = await PATCH(
      patchRequest(validUpdate()),
      routeContext(),
    );

    expect(workspaceDenied.status).toBe(404);
    expect(await workspaceDenied.json()).toEqual({
      error: "workspace_unavailable",
    });

    vi.mocked(loadPlanningWorkspaceVersion).mockResolvedValueOnce({
      ok: true,
      workspaceId,
      updatedAt,
    });
    vi.mocked(loadPlanningTask).mockResolvedValueOnce({
      ok: true,
      task: null,
    });

    const taskMissing = await PATCH(
      patchRequest(validUpdate()),
      routeContext(),
    );

    expect(taskMissing.status).toBe(404);
    expect(await taskMissing.json()).toEqual({ error: "task_unavailable" });
    expect(loadPlanningTask).toHaveBeenLastCalledWith(
      expect.anything(),
      workspaceId,
      taskId,
    );
  });

  it("rejects a stale task before writing", async () => {
    vi.mocked(loadPlanningTask).mockResolvedValue({
      ok: true,
      task: {
        ...taskResource(),
        updatedAt: "2026-07-29T12:05:00.000Z",
      },
    });

    const response = await PATCH(
      patchRequest(validUpdate()),
      routeContext(),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "version_conflict" });
    expect(updatePlanningTask).not.toHaveBeenCalled();
  });

  it("conditionally updates and returns a strict task resource", async () => {
    const supabase = enableAuthenticatedRequest();
    vi.mocked(updatePlanningTask).mockResolvedValue({
      ok: true,
      task: {
        ...taskResource(),
        status: "done",
        updatedAt: "2026-07-29T12:00:00.001Z",
      },
    });

    const response = await PATCH(
      patchRequest(validUpdate()),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(planningTaskResourceSchema.parse(body)).toEqual(body);
    expect(updatePlanningTask).toHaveBeenCalledWith(
      supabase,
      workspaceId,
      taskId,
      { status: "done" },
      updatedAt,
    );
  });

  it("returns a conflict when the conditional update loses a race", async () => {
    vi.mocked(updatePlanningTask).mockResolvedValue({
      ok: false,
      reason: "version_conflict",
    });

    const response = await PATCH(
      patchRequest(validUpdate()),
      routeContext(),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "version_conflict" });
  });

  it("conditionally deletes and returns strict confirmation", async () => {
    const supabase = enableAuthenticatedRequest();
    vi.mocked(deletePlanningTask).mockResolvedValue({ ok: true, taskId });

    const response = await DELETE(
      deleteRequest(),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-everaft-contract")).toBe(
      "urn:everaft:planning-task-delete-success:v1",
    );
    expect(planningTaskDeleteSuccessSchema.parse(body)).toEqual(body);
    expect(deletePlanningTask).toHaveBeenCalledWith(
      supabase,
      workspaceId,
      taskId,
      updatedAt,
    );
  });

  it("rejects stale deletes before writing and races during deletion", async () => {
    vi.mocked(loadPlanningTask).mockResolvedValueOnce({
      ok: true,
      task: {
        ...taskResource(),
        updatedAt: "2026-07-29T12:05:00.000Z",
      },
    });

    const stale = await DELETE(deleteRequest(), routeContext());

    expect(stale.status).toBe(409);
    expect(deletePlanningTask).not.toHaveBeenCalled();

    vi.mocked(loadPlanningTask).mockResolvedValueOnce({
      ok: true,
      task: taskResource(),
    });
    vi.mocked(deletePlanningTask).mockResolvedValueOnce({
      ok: false,
      reason: "version_conflict",
    });

    const race = await DELETE(deleteRequest(), routeContext());

    expect(race.status).toBe(409);
    expect(await race.json()).toEqual({ error: "version_conflict" });
  });

  it("keeps task Data API failures generic", async () => {
    vi.mocked(updatePlanningTask).mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    const response = await PATCH(
      patchRequest(validUpdate()),
      routeContext(),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "planning_api_unavailable",
    });
  });
});

function enableAuthenticatedRequest() {
  process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
  const supabase = { source: "caller-token" };
  vi.mocked(authenticatePlanningApiRequest).mockResolvedValue({
    ok: true,
    supabase,
    user: { id: "partner-1" },
  } as never);
  return supabase;
}

function patchRequest(body: unknown) {
  return request("PATCH", body);
}

function getRequest() {
  return new Request(
    `https://www.everaft.co.uk/api/planning/v1/workspaces/${workspaceId}/tasks/${taskId}`,
    { headers: { Authorization: "Bearer test-access-token" } },
  );
}

function deleteRequest() {
  return request("DELETE", {
    schemaVersion: 1,
    expectedTaskUpdatedAt: updatedAt,
  });
}

function request(method: string, body: unknown) {
  return new Request(
    `https://www.everaft.co.uk/api/planning/v1/workspaces/${workspaceId}/tasks/${taskId}`,
    {
      method,
      headers: {
        Authorization: "Bearer test-access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

function validUpdate() {
  return {
    schemaVersion: 1,
    expectedTaskUpdatedAt: updatedAt,
    changes: { status: "done" },
  };
}

function taskResource() {
  return {
    schemaVersion: 1 as const,
    id: taskId,
    workspaceId,
    title: "Confirm final guest numbers",
    notes: null,
    category: "guests" as const,
    status: "todo" as const,
    dueDate: "2027-07-01",
    sortOrder: 3,
    createdAt: "2026-07-29T11:00:00.000Z",
    updatedAt,
  };
}

function routeContext(currentTaskId = taskId) {
  return {
    params: Promise.resolve({ workspaceId, taskId: currentTaskId }),
  };
}
