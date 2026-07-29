import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
import { loadPlanningWorkspaceVersion } from "@/lib/planning-workspace/server-snapshot";
import { syncPlanningTablePlan } from "@/lib/planning-workspace/table-plan-api";
import { planningTablePlanUpdateSuccessSchema } from "@/lib/planning-workspace/table-plan-api-schema";
import { PATCH } from "./route";

vi.mock("@/lib/planning-workspace/api-auth", () => ({
  authenticatePlanningApiRequest: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/server-snapshot", () => ({
  loadPlanningWorkspaceVersion: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/table-plan-api", () => ({
  syncPlanningTablePlan: vi.fn(),
}));

const workspaceId = "60000000-0000-4000-8000-000000000006";
const updatedAt = "2026-07-29T12:00:00.000Z";

describe("Planning Table Plan API", () => {
  const previousCloudFlag = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;

  afterEach(() => {
    vi.clearAllMocks();
    if (previousCloudFlag === undefined) {
      delete process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;
    } else {
      process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = previousCloudFlag;
    }
  });

  it("rejects invalid seating before loading the workspace", async () => {
    enableAuthenticatedRequest();
    const response = await PATCH(request({
      schemaVersion: 1,
      expectedWorkspaceUpdatedAt: updatedAt,
      tablePlan: {
        ...tablePlan(),
        guests: [{
          id: "80000000-0000-4000-8000-000000000008",
          name: "Ailsa",
          tableId: null,
          seatIndex: 0,
        }],
      },
    }), routeContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(loadPlanningWorkspaceVersion).not.toHaveBeenCalled();
  });

  it("does not disclose an RLS-inaccessible workspace", async () => {
    enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceVersion).mockResolvedValue({
      ok: false,
      message: "That connected plan is unavailable or you no longer have access.",
    });

    const response = await PATCH(validRequest(), routeContext());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "workspace_unavailable" });
    expect(syncPlanningTablePlan).not.toHaveBeenCalled();
  });

  it("rejects a stale workspace before invoking the RPC", async () => {
    const supabase = enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceVersion).mockResolvedValue({
      ok: true,
      workspaceId,
      updatedAt: "2026-07-29T12:05:00.000Z",
    });

    const response = await PATCH(validRequest(), routeContext());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "version_conflict" });
    expect(loadPlanningWorkspaceVersion).toHaveBeenCalledWith(
      supabase,
      workspaceId,
    );
    expect(syncPlanningTablePlan).not.toHaveBeenCalled();
  });

  it("lets a partner atomically sync guests and tables", async () => {
    const supabase = enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceVersion).mockResolvedValue({
      ok: true,
      workspaceId,
      updatedAt,
    });
    vi.mocked(syncPlanningTablePlan).mockResolvedValue({
      ok: true,
      workspaceId,
      savedAt: "2026-07-29T12:00:00.001Z",
    });

    const response = await PATCH(validRequest(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-everaft-contract")).toBe(
      "urn:everaft:planning-table-plan-update-success:v1",
    );
    expect(planningTablePlanUpdateSuccessSchema.parse(body)).toEqual(body);
    expect(syncPlanningTablePlan).toHaveBeenCalledWith(
      supabase,
      workspaceId,
      tablePlan(),
      updatedAt,
    );
  });

  it("returns a conflict when the atomic RPC loses a race", async () => {
    enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceVersion).mockResolvedValue({
      ok: true,
      workspaceId,
      updatedAt,
    });
    vi.mocked(syncPlanningTablePlan).mockResolvedValue({
      ok: false,
      reason: "version_conflict",
    });

    const response = await PATCH(validRequest(), routeContext());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "version_conflict" });
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

function validRequest() {
  return request({
    schemaVersion: 1,
    expectedWorkspaceUpdatedAt: updatedAt,
    tablePlan: tablePlan(),
  });
}

function tablePlan() {
  return {
    schemaVersion: 1 as const,
    id: "table-plan-1",
    name: "Our tables",
    guests: [],
    tables: [{
      id: "90000000-0000-4000-8000-000000000009",
      name: "Top table",
      capacity: 8,
      locked: false,
    }],
    rules: [],
    updatedAt: "2026-07-29T12:01:00.000Z",
  };
}

function request(body: unknown) {
  return new Request(
    `https://www.everaft.co.uk/api/planning/v1/workspaces/${workspaceId}/table-plan`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer test-access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

function routeContext() {
  return { params: Promise.resolve({ workspaceId }) };
}
