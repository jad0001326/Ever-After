import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addManualPlanningHubVenue,
  createPlanningHubStarterPlan,
} from "@/lib/planning-hub/plan";
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
import {
  planningBudgetResourceSchema,
  planningBudgetUpdateSuccessSchema,
} from "@/lib/planning-workspace/budget-api-schema";
import { updatePlanningBudgetPlan } from "@/lib/planning-workspace/budget-api";
import { loadPlanningWorkspaceContext } from "@/lib/planning-workspace/server-snapshot";
import { GET, PATCH } from "./route";

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

  it("returns the complete connected budget with conflict versions", async () => {
    enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: true,
      budgetPlan: currentPlan(),
      snapshot: {
        workspace: { updated_at: updatedAt },
      },
      isOwner: true,
    } as never);

    const response = await GET(readRequest(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-everaft-contract")).toBe(
      "urn:everaft:planning-budget-resource:v1",
    );
    expect(planningBudgetResourceSchema.parse(body)).toEqual(body);
  });

  it("does not disclose an inaccessible budget on read", async () => {
    enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: false,
      message: "unavailable",
    });

    const response = await GET(readRequest(), routeContext());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "workspace_unavailable" });
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

  it("rejects a changed payment schedule whose rows contradict its aggregates", async () => {
    enableAuthenticatedRequest();
    const current = {
      ...addManualPlanningHubVenue(
        currentPlan(),
        "Test venue",
        100_000,
        "booked",
      ),
      updatedAt,
    };
    const item = current.items[0];
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: true,
      budgetPlan: current,
      snapshot: {
        workspace: { owner_id: "owner-1" },
      },
      isOwner: true,
    } as never);
    const response = await PATCH(request({
      schemaVersion: 1,
      expectedBudgetUpdatedAt: updatedAt,
      plan: {
        ...current,
        items: current.items.map((candidate) => candidate.id === item.id ? {
          ...candidate,
          installments: [{
            id: "deposit-1",
            kind: "deposit",
            label: "Deposit",
            amountPence: 100_000,
            paidPence: 50_000,
            dueDate: "2027-02-01",
            paidAt: null,
          }],
          depositPaidPence: 0,
          totalPaidPence: 0,
          dueDate: null,
          paymentStatus: "not_started",
        } : candidate),
      },
    }), routeContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(updatePlanningBudgetPlan).not.toHaveBeenCalled();
  });

  it("allows cancellation while retaining a valid payment history", async () => {
    const supabase = enableAuthenticatedRequest();
    const current = currentPlan();
    const scheduled = {
      ...current,
      items: current.items.map((item) => ({
        ...item,
        installments: [{
          id: "deposit-1",
          kind: "deposit" as const,
          label: "Deposit",
          amountPence: 25_000,
          paidPence: 10_000,
          dueDate: "2027-02-01",
          paidAt: null,
        }],
        depositPaidPence: 10_000,
        totalPaidPence: 10_000,
        dueDate: "2027-02-01",
        paymentStatus: "deposit_paid" as const,
        costStatus: "deposit_paid" as const,
      })),
    };
    const cancelled = {
      ...scheduled,
      items: scheduled.items.map((item) => ({
        ...item,
        bookingStatus: "cancelled" as const,
        costStatus: "cancelled" as const,
      })),
    };
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: true,
      budgetPlan: scheduled,
      snapshot: {
        workspace: { owner_id: "owner-1" },
      },
      isOwner: true,
    } as never);
    vi.mocked(updatePlanningBudgetPlan).mockResolvedValue({
      ok: true,
      budgetPlanId: "budget-1",
      savedAt: "2026-07-29T12:00:00.001Z",
    });

    const response = await PATCH(request({
      schemaVersion: 1,
      expectedBudgetUpdatedAt: updatedAt,
      plan: cancelled,
    }), routeContext());

    expect(response.status).toBe(200);
    expect(updatePlanningBudgetPlan).toHaveBeenCalledWith(
      supabase,
      "owner-1",
      cancelled,
      updatedAt,
    );
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
  const plan = addManualPlanningHubVenue(
    createPlanningHubStarterPlan("partner-1"),
    "Test venue",
    100_000,
    "booked",
  );
  return {
    ...plan,
    id: "budget-1",
    updatedAt,
    totalBudgetPence: 3_000_000,
    items: plan.items.map((item) => ({
      ...item,
      id: "venue-1",
      updatedAt,
    })),
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

function readRequest() {
  return new Request(
    `https://www.everaft.co.uk/api/planning/v1/workspaces/${workspaceId}/budget`,
    { headers: { Authorization: "Bearer test-access-token" } },
  );
}

function routeContext() {
  return { params: Promise.resolve({ workspaceId }) };
}
