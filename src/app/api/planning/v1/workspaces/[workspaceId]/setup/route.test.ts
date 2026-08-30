import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
import { updatePlanningWorkspaceSetup } from "@/lib/planning-workspace/connection-api";
import { createPlanningConnectedPlanResource } from "@/lib/planning-workspace/connected-resource";
import { loadPlanningWorkspaceContext } from "@/lib/planning-workspace/server-snapshot";
import { PATCH } from "./route";

vi.mock("@/lib/planning-workspace/api-auth", () => ({ authenticatePlanningApiRequest: vi.fn() }));
vi.mock("@/lib/planning-workspace/connection-api", () => ({ updatePlanningWorkspaceSetup: vi.fn() }));
vi.mock("@/lib/planning-workspace/connected-resource", () => ({ createPlanningConnectedPlanResource: vi.fn() }));
vi.mock("@/lib/planning-workspace/server-snapshot", () => ({ loadPlanningWorkspaceContext: vi.fn() }));

const workspaceId = "60000000-0000-4000-8000-000000000006";
const previous = "2026-08-27T08:00:00.000Z";
const updated = "2026-08-27T09:00:00.000Z";

describe("Planning workspace setup API", () => {
  const previousFlag = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;
  afterEach(() => {
    vi.clearAllMocks();
    if (previousFlag === undefined) delete process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;
    else process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = previousFlag;
  });

  it("returns a canonical response only when all reloaded versions match", async () => {
    enableAuth();
    vi.mocked(updatePlanningWorkspaceSetup).mockResolvedValue({ ok: true, versions: versions(updated) });
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: true,
      budgetPlan: { updatedAt: updated },
      snapshot: { workspace: { updated_at: updated }, profile: { updated_at: updated } },
    } as never);
    vi.mocked(createPlanningConnectedPlanResource).mockReturnValue(resource() as never);
    const response = await PATCH(request(setupBody()), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("treats an inaccessible RPC target as not found", async () => {
    enableAuth();
    vi.mocked(updatePlanningWorkspaceSetup).mockResolvedValue({ ok: false, reason: "not_found" });
    const response = await PATCH(request(setupBody()), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "workspace_unavailable" });
  });

  it("does not claim success when the post-write reload has different versions", async () => {
    enableAuth();
    vi.mocked(updatePlanningWorkspaceSetup).mockResolvedValue({ ok: true, versions: versions(updated) });
    vi.mocked(loadPlanningWorkspaceContext).mockResolvedValue({
      ok: true,
      budgetPlan: { updatedAt: previous },
      snapshot: { workspace: { updated_at: updated }, profile: { updated_at: updated } },
    } as never);
    const response = await PATCH(request(setupBody()), context());
    expect(response.status).toBe(503);
    expect(createPlanningConnectedPlanResource).not.toHaveBeenCalled();
  });
});

function enableAuth() {
  process.env.PLANNING_WORKSPACE_CLOUD_ENABLED = "true";
  vi.mocked(authenticatePlanningApiRequest).mockResolvedValue({ ok: true, supabase: {}, user: { id: "70000000-0000-4000-8000-000000000007" } } as never);
}

function setupBody() {
  return { schemaVersion: 1, expectedVersions: { workspaceUpdatedAt: previous, budgetUpdatedAt: previous, profileUpdatedAt: null }, setup: { totalBudgetPence: 2_500_000, profile: { schemaVersion: 1, weddingDate: "2027-08-21", guestCount: 80, location: "Edinburgh", dateFlexibility: "fixed", locationFlexible: false, priorities: ["venue", "photography"], venueStyles: [], photographyStyles: [], vision: null } } };
}
function resource() {
  const plan = { ...createPlanningHubStarterPlan("70000000-0000-4000-8000-000000000007"), id: "budget-1", updatedAt: updated };
  return {
    schemaVersion: 1,
    workspace: { schemaVersion: 1, id: workspaceId, name: "My EverAft", budgetPlanId: "budget-1", role: "owner", createdAt: previous, updatedAt: updated },
    budgetPlan: plan,
    profile: { ...setupBody().setup.profile, updatedAt: updated },
    versions: versions(updated),
  };
}
function versions(value: string) { return { workspaceUpdatedAt: value, budgetUpdatedAt: value, profileUpdatedAt: value }; }
function context() { return { params: Promise.resolve({ workspaceId }) }; }
function request(body: unknown) { return new Request(`https://www.everaft.co.uk/api/planning/v1/workspaces/${workspaceId}/setup`, { method: "PATCH", headers: { Authorization: "Bearer token", "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
