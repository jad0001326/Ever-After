import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
import { listPlanningWorkspaces } from "@/lib/planning-workspace/workspace-api";
import { planningWorkspaceCollectionSchema } from "@/lib/planning-workspace/workspace-api-schema";
import { GET } from "./route";

vi.mock("@/lib/planning-workspace/api-auth", () => ({
  authenticatePlanningApiRequest: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/workspace-api", () => ({
  listPlanningWorkspaces: vi.fn(),
}));

describe("Planning Workspace collection API", () => {
  const previousCloudFlag = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;

  beforeEach(() => {
    enableAuthenticatedRequest();
    vi.mocked(listPlanningWorkspaces).mockResolvedValue({
      ok: true,
      workspaces: [workspaceResource()],
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

  it("returns a strict bounded page with the caller's role", async () => {
    const supabase = enableAuthenticatedRequest();
    const response = await GET(getRequest("?limit=10&offset=20"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-everaft-contract")).toBe(
      "urn:everaft:planning-workspace-collection:v1",
    );
    expect(planningWorkspaceCollectionSchema.parse(body)).toEqual(body);
    expect(body.page).toEqual({ limit: 10, offset: 20, hasMore: false });
    expect(listPlanningWorkspaces).toHaveBeenCalledWith(
      supabase,
      "partner-1",
      20,
      10,
    );
  });

  it("rejects invalid pagination before querying workspace data", async () => {
    const response = await GET(getRequest("?limit=51"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_pagination" });
    expect(listPlanningWorkspaces).not.toHaveBeenCalled();
  });

  it("maps Data API and inconsistent result failures separately", async () => {
    vi.mocked(listPlanningWorkspaces).mockResolvedValueOnce({
      ok: false,
      reason: "unavailable",
    });
    const unavailable = await GET(getRequest());
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({
      error: "planning_api_unavailable",
    });

    vi.mocked(listPlanningWorkspaces).mockResolvedValueOnce({
      ok: false,
      reason: "invalid_result",
    });
    const invalid = await GET(getRequest());
    expect(invalid.status).toBe(500);
    expect(await invalid.json()).toEqual({
      error: "workspace_collection_unavailable",
    });
  });

  it("maps bearer rejection and authentication outages separately", async () => {
    vi.mocked(authenticatePlanningApiRequest).mockResolvedValueOnce({
      ok: false,
      reason: "missing_bearer",
    });
    const unauthorized = await GET(getRequest());
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("www-authenticate")).toContain("Bearer");
    expect(await unauthorized.json()).toEqual({
      error: "authentication_required",
    });

    vi.mocked(authenticatePlanningApiRequest).mockResolvedValueOnce({
      ok: false,
      reason: "authentication_unavailable",
    });
    const unavailable = await GET(getRequest());
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({
      error: "planning_api_unavailable",
    });
    expect(listPlanningWorkspaces).not.toHaveBeenCalled();
  });

  it("remains dormant before bearer authentication", async () => {
    delete process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;

    const response = await GET(getRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "connected_planning_disabled",
    });
    expect(authenticatePlanningApiRequest).not.toHaveBeenCalled();
    expect(listPlanningWorkspaces).not.toHaveBeenCalled();
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
    `https://www.everaft.co.uk/api/planning/v1/workspaces${query}`,
    { headers: { Authorization: "Bearer test-access-token" } },
  );
}

function workspaceResource() {
  return {
    schemaVersion: 1 as const,
    id: "60000000-0000-4000-8000-000000000006",
    name: "Ailsa and Rowan",
    budgetPlanId: "budget-1",
    role: "partner" as const,
    createdAt: "2026-07-29T11:00:00.000Z",
    updatedAt: "2026-07-29T12:00:00.000Z",
  };
}
