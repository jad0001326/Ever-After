import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
import {
  createPlanningTask,
  listPlanningTasks,
} from "@/lib/planning-workspace/task-api";
import {
  planningTaskCollectionSchema,
  planningTaskResourceSchema,
} from "@/lib/planning-workspace/task-api-schema";
import { loadPlanningWorkspaceVersion } from "@/lib/planning-workspace/server-snapshot";
import { GET, POST } from "./route";

vi.mock("@/lib/planning-workspace/api-auth", () => ({
  authenticatePlanningApiRequest: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/server-snapshot", () => ({
  loadPlanningWorkspaceVersion: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/task-api", () => ({
  createPlanningTask: vi.fn(),
  listPlanningTasks: vi.fn(),
}));

const workspaceId = "60000000-0000-4000-8000-000000000006";

describe("Planning Task collection API", () => {
  const previousCloudFlag = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;

  beforeEach(() => {
    enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceVersion).mockResolvedValue({
      ok: true,
      workspaceId,
      updatedAt: "2026-07-29T12:01:00.000Z",
    });
    vi.mocked(listPlanningTasks).mockResolvedValue({
      ok: true,
      tasks: [taskResource()],
      hasMore: false,
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

  it("returns a strict bounded page for a partner", async () => {
    const supabase = enableAuthenticatedRequest();
    const response = await GET(
      getRequest("?limit=25&offset=50"),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-everaft-contract")).toBe(
      "urn:everaft:planning-task-collection:v1",
    );
    expect(planningTaskCollectionSchema.parse(body)).toEqual(body);
    expect(body.page).toEqual({ limit: 25, offset: 50, hasMore: false });
    expect(listPlanningTasks).toHaveBeenCalledWith(
      supabase,
      workspaceId,
      50,
      25,
    );
  });

  it("rejects invalid pagination before loading workspace data", async () => {
    const response = await GET(getRequest("?limit=101"), routeContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_pagination" });
    expect(loadPlanningWorkspaceVersion).not.toHaveBeenCalled();
    expect(listPlanningTasks).not.toHaveBeenCalled();
  });

  it("does not disclose an RLS-inaccessible workspace", async () => {
    vi.mocked(loadPlanningWorkspaceVersion).mockResolvedValue({
      ok: false,
      message: "That connected plan is unavailable or you no longer have access.",
    });
    vi.mocked(listPlanningTasks).mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    const response = await GET(getRequest(), routeContext());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "workspace_unavailable" });
  });

  it("rejects identity escape fields before loading the workspace", async () => {
    const response = await POST(postRequest({
      ...validCreate(),
      task: {
        ...taskContent(),
        workspaceId: "80000000-0000-4000-8000-000000000008",
      },
    }), routeContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(loadPlanningWorkspaceVersion).not.toHaveBeenCalled();
    expect(createPlanningTask).not.toHaveBeenCalled();
  });

  it("creates a strict task resource for a partner", async () => {
    const supabase = enableAuthenticatedRequest();
    vi.mocked(createPlanningTask).mockResolvedValue({
      ok: true,
      task: taskResource(),
    });

    const response = await POST(postRequest(validCreate()), routeContext());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(planningTaskResourceSchema.parse(body)).toEqual(body);
    expect(response.headers.get("x-everaft-contract")).toBe(
      "urn:everaft:planning-task-resource:v1",
    );
    expect(createPlanningTask).toHaveBeenCalledWith(
      supabase,
      workspaceId,
      { id: taskResource().id, ...taskContent() },
    );
  });

  it("maps stable-ID collisions and Data API failures separately", async () => {
    vi.mocked(createPlanningTask).mockResolvedValueOnce({
      ok: false,
      reason: "version_conflict",
    });

    const conflict = await POST(postRequest(validCreate()), routeContext());

    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: "version_conflict" });

    vi.mocked(createPlanningTask).mockResolvedValueOnce({
      ok: false,
      reason: "unavailable",
    });

    const unavailable = await POST(postRequest(validCreate()), routeContext());

    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({
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

function getRequest(query = "") {
  return new Request(
    `https://www.everaft.co.uk/api/planning/v1/workspaces/${workspaceId}/tasks${query}`,
    { headers: { Authorization: "Bearer test-access-token" } },
  );
}

function postRequest(body: unknown) {
  return new Request(
    `https://www.everaft.co.uk/api/planning/v1/workspaces/${workspaceId}/tasks`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer test-access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

function validCreate() {
  return {
    schemaVersion: 1,
    task: {
      id: taskResource().id,
      ...taskContent(),
    },
  };
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
    id: "70000000-0000-4000-8000-000000000007",
    workspaceId,
    ...taskContent(),
    createdAt: "2026-07-29T11:00:00.000Z",
    updatedAt: "2026-07-29T12:00:00.000Z",
  };
}

function routeContext() {
  return { params: Promise.resolve({ workspaceId }) };
}
