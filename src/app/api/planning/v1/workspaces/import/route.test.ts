import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
import { importPlanningWorkspaceConnection } from "@/lib/planning-workspace/connection-api";
import { createPlanningConnectedPlanResource } from "@/lib/planning-workspace/connected-resource";
import { loadPlanningWorkspaceContext } from "@/lib/planning-workspace/server-snapshot";
import { POST } from "./route";

vi.mock("@/lib/planning-workspace/api-auth", () => ({ authenticatePlanningApiRequest: vi.fn() }));
vi.mock("@/lib/planning-workspace/connection-api", () => ({ importPlanningWorkspaceConnection: vi.fn() }));
vi.mock("@/lib/planning-workspace/connected-resource", () => ({ createPlanningConnectedPlanResource: vi.fn() }));
vi.mock("@/lib/planning-workspace/server-snapshot", () => ({ loadPlanningWorkspaceContext: vi.fn() }));

const workspaceId = "60000000-0000-4000-8000-000000000006";

describe("Planning workspace import API", () => {
  const previousFlag = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;

  afterEach(() => {
    vi.clearAllMocks();
    if (previousFlag === undefined) delete process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;
    else process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = previousFlag;
  });

  it("creates a workspace then reloads a canonical no-store resource", async () => {
    enableAuth();
    const expected = resource();
    vi.mocked(importPlanningWorkspaceConnection).mockResolvedValue({ ok: true, workspaceId });
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({ ok: true } as never);
    vi.mocked(createPlanningConnectedPlanResource).mockReturnValue(expected as never);

    const response = await POST(request(importBody()));

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual(JSON.parse(JSON.stringify(expected)));
  });

  it("maps a stale or duplicate import to a version conflict", async () => {
    enableAuth();
    vi.mocked(importPlanningWorkspaceConnection).mockResolvedValue({ ok: false, reason: "conflict" });
    const response = await POST(request(importBody()));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "version_conflict" });
    expect(loadPlanningWorkspaceContext).not.toHaveBeenCalled();
  });

  it("rejects inconsistent input before invoking the RPC", async () => {
    enableAuth();
    const body = importBody();
    const response = await POST(request({ ...body, snapshot: { ...body.snapshot, budgetPlanId: "other" } }));
    expect(response.status).toBe(400);
    expect(importPlanningWorkspaceConnection).not.toHaveBeenCalled();
  });
});

function enableAuth() {
  process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
  vi.mocked(authenticatePlanningApiRequest).mockResolvedValue({
    ok: true,
    supabase: { source: "caller-token" },
    user: { id: "70000000-0000-4000-8000-000000000007" },
  } as never);
}

function importBody() {
  const plan = { ...createPlanningHubStarterPlan(null), id: "budget-1" };
  return {
    schemaVersion: 1,
    snapshot: {
      id: workspaceId,
      budgetPlanId: plan.id,
      name: "My EverAft",
      profile: profile(),
      tasks: [], guests: [], tables: [], seats: [], rules: [],
    },
    budgetPlan: plan,
    targetWorkspaceId: null,
    expectedWorkspaceUpdatedAt: null,
  };
}

function resource() {
  const plan = { ...createPlanningHubStarterPlan("70000000-0000-4000-8000-000000000007"), id: "budget-1" };
  return {
    schemaVersion: 1,
    workspace: { schemaVersion: 1, id: workspaceId, name: "My EverAft", budgetPlanId: "budget-1", role: "owner", createdAt: plan.createdAt, updatedAt: plan.updatedAt },
    budgetPlan: plan,
    profile: profile(),
    versions: { workspaceUpdatedAt: plan.updatedAt, budgetUpdatedAt: plan.updatedAt, profileUpdatedAt: plan.updatedAt },
  };
}

function profile() {
  return { schemaVersion: 1, weddingDate: "2027-08-21", guestCount: 80, location: "Edinburgh", dateFlexibility: "fixed", locationFlexible: false, priorities: ["venue", "photography"], venueStyles: [], photographyStyles: [], vision: null, updatedAt: "2026-08-27T09:00:00.000Z" };
}

function request(body: unknown) {
  return new Request("https://www.everaft.co.uk/api/planning/v1/workspaces/import", {
    method: "POST",
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
