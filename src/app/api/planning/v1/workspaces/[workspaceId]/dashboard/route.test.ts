import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
import { planningWorkspaceFromCloud } from "@/lib/planning-workspace/cloud";
import { planningDashboardSnapshotSchema } from "@/lib/planning-workspace/snapshot-schema";
import { loadPlanningWorkspaceContext } from "@/lib/planning-workspace/server-snapshot";
import { createEmptyPlanningWorkspace } from "@/lib/planning-workspace/workspace";
import { GET } from "./route";

vi.mock("@/lib/planning-workspace/api-auth", () => ({
  authenticatePlanningApiRequest: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/server-snapshot", () => ({
  loadPlanningWorkspaceContext: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/cloud", () => ({
  planningWorkspaceFromCloud: vi.fn(),
}));

const workspaceId = "60000000-0000-4000-8000-000000000006";
const request = () => new Request(
  `https://www.everaft.co.uk/api/planning/v1/workspaces/${workspaceId}/dashboard`,
  { headers: { Authorization: "Bearer test-access-token" } },
);
const routeContext = (id = workspaceId) => ({
  params: Promise.resolve({ workspaceId: id }),
});

describe("Planning Dashboard API", () => {
  const previousCloudFlag = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;

  afterEach(() => {
    vi.clearAllMocks();
    if (previousCloudFlag === undefined) {
      delete process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;
    } else {
      process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = previousCloudFlag;
    }
  });

  it("fails closed before authentication while connected planning is disabled", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "false";

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "connected_planning_disabled",
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    expect(authenticatePlanningApiRequest).not.toHaveBeenCalled();
  });

  it("rejects malformed workspace identifiers before querying Supabase", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";

    const response = await GET(request(), routeContext("not-a-workspace-id"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_workspace_id" });
    expect(authenticatePlanningApiRequest).not.toHaveBeenCalled();
  });

  it("requires a verified bearer token", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
    vi.mocked(authenticatePlanningApiRequest).mockResolvedValue({
      ok: false,
      reason: "invalid_token",
    });

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer realm="EverAft Planning API"',
    );
    expect(await response.json()).toEqual({
      error: "authentication_required",
    });
    expect(loadPlanningWorkspaceContext).not.toHaveBeenCalled();
  });

  it("does not disclose whether an RLS-inaccessible workspace exists", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
    const supabase = { source: "caller-token" };
    vi.mocked(authenticatePlanningApiRequest).mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "outsider-1" },
    } as never);
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: false,
      message: "That connected plan is unavailable or you no longer have access.",
    });

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "workspace_unavailable" });
    expect(loadPlanningWorkspaceContext).toHaveBeenCalledWith(
      supabase,
      workspaceId,
      "outsider-1",
      { includeSharing: false },
    );
  });

  it("returns a generic unavailable response when the RLS query fails", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
    vi.mocked(authenticatePlanningApiRequest).mockResolvedValue({
      ok: true,
      supabase: {},
      user: { id: "partner-1" },
    } as never);
    vi.mocked(loadPlanningWorkspaceContext).mockRejectedValue(
      new Error("upstream unavailable"),
    );

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "planning_api_unavailable",
    });
  });

  it("returns the strict versioned snapshot through the caller's RLS client", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
    const supabase = { source: "caller-token" };
    const plan = {
      ...createPlanningHubStarterPlan("owner-1"),
      id: "budget-1",
    };
    const workspace = createEmptyPlanningWorkspace({
      ownerId: "owner-1",
      budgetPlanId: plan.id,
    });
    vi.mocked(authenticatePlanningApiRequest).mockResolvedValue({
      ok: true,
      supabase,
      user: { id: "partner-1" },
    } as never);
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: true,
      budgetPlan: plan,
      isOwner: false,
      snapshot: { workspace: { id: workspaceId } },
    } as never);
    vi.mocked(planningWorkspaceFromCloud).mockReturnValue(workspace);

    const response = await GET(request(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-everaft-contract")).toBe(
      "urn:everaft:planning-dashboard-snapshot:v1",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(planningDashboardSnapshotSchema.parse(body)).toEqual(body);
    expect(JSON.stringify(body)).not.toContain("\"href\"");
    expect(loadPlanningWorkspaceContext).toHaveBeenCalledWith(
      supabase,
      workspaceId,
      "partner-1",
      { includeSharing: false },
    );
  });

  it("fails closed if the loaded plan and workspace do not match", async () => {
    process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
    const plan = {
      ...createPlanningHubStarterPlan("owner-1"),
      id: "budget-1",
    };
    vi.mocked(authenticatePlanningApiRequest).mockResolvedValue({
      ok: true,
      supabase: {},
      user: { id: "owner-1" },
    } as never);
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: true,
      budgetPlan: plan,
      isOwner: true,
      snapshot: {},
    } as never);
    vi.mocked(planningWorkspaceFromCloud).mockReturnValue(
      createEmptyPlanningWorkspace({
        ownerId: "owner-1",
        budgetPlanId: "different-budget",
      }),
    );

    const response = await GET(request(), routeContext());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "snapshot_unavailable" });
  });
});
