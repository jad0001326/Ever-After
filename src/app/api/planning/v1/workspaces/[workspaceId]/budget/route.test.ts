import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
import { planningBudgetUpdateSuccessSchema } from "@/lib/planning-workspace/budget-api-schema";
import { updatePlanningBudgetPlan } from "@/lib/planning-workspace/budget-api";
import { loadPlanningWorkspaceContext } from "@/lib/planning-workspace/server-snapshot";
import { PATCH } from "./route";

vi.mock("@/lib/planning-workspace/api-auth", () => ({
  authenticatePlanningApiRequest: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/server-snapshot", () => ({
  loadPlanningWorkspaceContext: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/budget-api", () => ({
  updatePlanningBudgetPlan: vi.fn(),
}));

const workspaceId = "60000000-0000-4000-8000-000000000006";
const updatedAt = "2026-07-29T12:00:00.000Z";

describe("Planning Budget API", () => {
  const previousCloudFlag = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;

  afterEach(() => {
    vi.clearAllMocks();
    if (previousCloudFlag === undefined) {
      delete process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;
    } else {
      process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = previousCloudFlag;
    }
  });

  it("rejects unsupported content before loading a workspace", async () => {
    enableAuthenticatedRequest();
    const response = await PATCH(
      request("not json", "text/plain"),
      routeContext(),
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({
      error: "unsupported_media_type",
    });
    expect(loadPlanningWorkspaceContext).not.toHaveBeenCalled();
  });

  it("rejects invalid or internally inconsistent request versions", async () => {
    enableAuthenticatedRequest();
    const plan = currentPlan();
    const response = await PATCH(request({
      schemaVersion: 1,
      expectedBudgetUpdatedAt: updatedAt,
      plan: {
        ...plan,
        updatedAt: "2026-07-29T12:01:00.000Z",
      },
    }), routeContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(loadPlanningWorkspaceContext).not.toHaveBeenCalled();
  });

  it("rejects request bodies above the one-megabyte boundary", async () => {
    enableAuthenticatedRequest();
    const response = await PATCH(
      request("a".repeat(1_000_001)),
      routeContext(),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "payload_too_large" });
    expect(loadPlanningWorkspaceContext).not.toHaveBeenCalled();
  });

  it("returns a conflict before writing when a newer budget was loaded", async () => {
    const supabase = enableAuthenticatedRequest();
    const plan = currentPlan();
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: true,
      budgetPlan: {
        ...plan,
        updatedAt: "2026-07-29T12:05:00.000Z",
      },
      snapshot: {
        workspace: { owner_id: "owner-1" },
      },
      isOwner: false,
    } as never);

    const response = await PATCH(request({
      schemaVersion: 1,
      expectedBudgetUpdatedAt: updatedAt,
      plan,
    }), routeContext());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "version_conflict" });
    expect(loadPlanningWorkspaceContext).toHaveBeenCalledWith(
      supabase,
      workspaceId,
      "partner-1",
      { includeSharing: false },
    );
    expect(updatePlanningBudgetPlan).not.toHaveBeenCalled();
  });

  it("does not disclose an RLS-inaccessible workspace", async () => {
    enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: false,
      message: "That connected plan is unavailable or you no longer have access.",
    });

    const response = await PATCH(validRequest(), routeContext());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "workspace_unavailable" });
    expect(updatePlanningBudgetPlan).not.toHaveBeenCalled();
  });

  it("refuses to replace the workspace's linked budget with another plan", async () => {
    enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: true,
      budgetPlan: currentPlan(),
      snapshot: {
        workspace: { owner_id: "owner-1" },
      },
      isOwner: true,
    } as never);
    const response = await PATCH(request({
      schemaVersion: 1,
      expectedBudgetUpdatedAt: updatedAt,
      plan: {
        ...currentPlan(),
        id: "different-budget",
      },
    }), routeContext());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "version_conflict" });
    expect(updatePlanningBudgetPlan).not.toHaveBeenCalled();
  });

  it("conditionally writes the owner-linked plan and returns its new version", async () => {
    const supabase = enableAuthenticatedRequest();
    const plan = currentPlan();
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: true,
      budgetPlan: plan,
      snapshot: {
        workspace: { owner_id: "owner-1" },
      },
      isOwner: false,
    } as never);
    vi.mocked(updatePlanningBudgetPlan).mockResolvedValue({
      ok: true,
      budgetPlanId: "budget-1",
      savedAt: "2026-07-29T12:00:00.001Z",
    });

    const response = await PATCH(request({
      schemaVersion: 1,
      expectedBudgetUpdatedAt: updatedAt,
      plan,
    }), routeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-everaft-contract")).toBe(
      "urn:everaft:planning-budget-update-success:v1",
    );
    expect(planningBudgetUpdateSuccessSchema.parse(body)).toEqual(body);
    expect(updatePlanningBudgetPlan).toHaveBeenCalledWith(
      supabase,
      "owner-1",
      plan,
      updatedAt,
    );
  });

  it("returns a conflict when the conditional update loses a race", async () => {
    enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: true,
      budgetPlan: currentPlan(),
      snapshot: {
        workspace: { owner_id: "owner-1" },
      },
      isOwner: true,
    } as never);
    vi.mocked(updatePlanningBudgetPlan).mockResolvedValue({
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

function currentPlan() {
  return {
    ...createPlanningHubStarterPlan("partner-1"),
    id: "budget-1",
    updatedAt,
    totalBudgetPence: 3_000_000,
  };
}

function validRequest() {
  return request({
    schemaVersion: 1,
    expectedBudgetUpdatedAt: updatedAt,
    plan: currentPlan(),
  });
}

function request(body: unknown, contentType = "application/json") {
  return new Request(
    `https://www.everaft.co.uk/api/planning/v1/workspaces/${workspaceId}/budget`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer test-access-token",
        "Content-Type": contentType,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

function routeContext() {
  return { params: Promise.resolve({ workspaceId }) };
}
