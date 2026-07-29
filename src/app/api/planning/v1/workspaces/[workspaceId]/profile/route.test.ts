import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
import {
  loadPlanningProfile,
  savePlanningProfile,
} from "@/lib/planning-workspace/profile-api";
import { planningProfileResourceSchema } from "@/lib/planning-workspace/profile-api-schema";
import { loadPlanningWorkspaceVersion } from "@/lib/planning-workspace/server-snapshot";
import { GET, PATCH } from "./route";

vi.mock("@/lib/planning-workspace/api-auth", () => ({
  authenticatePlanningApiRequest: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/server-snapshot", () => ({
  loadPlanningWorkspaceVersion: vi.fn(),
}));
vi.mock("@/lib/planning-workspace/profile-api", () => ({
  loadPlanningProfile: vi.fn(),
  savePlanningProfile: vi.fn(),
}));

const workspaceId = "60000000-0000-4000-8000-000000000006";
const updatedAt = "2026-07-29T12:00:00.000Z";

describe("Planning Profile API", () => {
  const previousCloudFlag = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED;

  beforeEach(() => {
    enableAuthenticatedRequest();
    vi.mocked(loadPlanningWorkspaceVersion).mockResolvedValue({
      ok: true,
      workspaceId,
      updatedAt: "2026-07-29T12:01:00.000Z",
    });
    vi.mocked(loadPlanningProfile).mockResolvedValue({
      ok: true,
      profile: savedProfile(),
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

  it("returns a strict no-store profile resource for a partner", async () => {
    const response = await GET(getRequest(), routeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-everaft-contract")).toBe(
      "urn:everaft:planning-profile-resource:v1",
    );
    expect(planningProfileResourceSchema.parse(body)).toEqual(body);
    expect(body).toEqual({
      schemaVersion: 1,
      workspaceId,
      profile: savedProfile(),
    });
  });

  it("returns null for an accessible workspace without a profile", async () => {
    vi.mocked(loadPlanningProfile).mockResolvedValue({
      ok: true,
      profile: null,
    });

    const response = await GET(getRequest(), routeContext());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      schemaVersion: 1,
      workspaceId,
      profile: null,
    });
  });

  it("does not disclose an RLS-inaccessible workspace", async () => {
    vi.mocked(loadPlanningWorkspaceVersion).mockResolvedValue({
      ok: false,
      message: "That connected plan is unavailable or you no longer have access.",
    });
    vi.mocked(loadPlanningProfile).mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    const response = await GET(getRequest(), routeContext());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "workspace_unavailable" });
  });

  it("rejects unknown or client-controlled profile fields before loading", async () => {
    const response = await PATCH(patchRequest({
      ...validUpdate(),
      profile: {
        ...profileContent(),
        updatedAt,
      },
    }), routeContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(loadPlanningWorkspaceVersion).not.toHaveBeenCalled();
    expect(loadPlanningProfile).not.toHaveBeenCalled();
  });

  it("lets a partner create the missing profile with a null version", async () => {
    const supabase = enableAuthenticatedRequest();
    vi.mocked(loadPlanningProfile).mockResolvedValue({
      ok: true,
      profile: null,
    });
    vi.mocked(savePlanningProfile).mockResolvedValue({
      ok: true,
      profile: savedProfile(),
    });

    const response = await PATCH(
      patchRequest(validUpdate(null)),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      schemaVersion: 1,
      workspaceId,
      profile: savedProfile(),
    });
    expect(savePlanningProfile).toHaveBeenCalledWith(
      supabase,
      workspaceId,
      profileContent(),
      null,
    );
  });

  it("conditionally updates the exact loaded profile version", async () => {
    const supabase = enableAuthenticatedRequest();
    vi.mocked(savePlanningProfile).mockResolvedValue({
      ok: true,
      profile: {
        ...savedProfile(),
        updatedAt: "2026-07-29T12:00:00.001Z",
      },
    });

    const response = await PATCH(
      patchRequest(validUpdate()),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(savePlanningProfile).toHaveBeenCalledWith(
      supabase,
      workspaceId,
      profileContent(),
      updatedAt,
    );
  });

  it("rejects stale prechecks and conditional-write races", async () => {
    vi.mocked(loadPlanningProfile).mockResolvedValueOnce({
      ok: true,
      profile: {
        ...savedProfile(),
        updatedAt: "2026-07-29T12:05:00.000Z",
      },
    });

    const staleResponse = await PATCH(
      patchRequest(validUpdate()),
      routeContext(),
    );

    expect(staleResponse.status).toBe(409);
    expect(await staleResponse.json()).toEqual({ error: "version_conflict" });
    expect(savePlanningProfile).not.toHaveBeenCalled();

    vi.mocked(loadPlanningProfile).mockResolvedValueOnce({
      ok: true,
      profile: savedProfile(),
    });
    vi.mocked(savePlanningProfile).mockResolvedValueOnce({
      ok: false,
      reason: "version_conflict",
    });

    const raceResponse = await PATCH(
      patchRequest(validUpdate()),
      routeContext(),
    );

    expect(raceResponse.status).toBe(409);
    expect(await raceResponse.json()).toEqual({ error: "version_conflict" });
  });

  it("keeps Data API failures generic", async () => {
    vi.mocked(savePlanningProfile).mockResolvedValue({
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

function getRequest() {
  return new Request(
    `https://www.everaft.co.uk/api/planning/v1/workspaces/${workspaceId}/profile`,
    {
      headers: { Authorization: "Bearer test-access-token" },
    },
  );
}

function patchRequest(body: unknown) {
  return new Request(
    `https://www.everaft.co.uk/api/planning/v1/workspaces/${workspaceId}/profile`,
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

function validUpdate(expectedProfileUpdatedAt: string | null = updatedAt) {
  return {
    schemaVersion: 1,
    expectedProfileUpdatedAt,
    profile: profileContent(),
  };
}

function profileContent() {
  return {
    schemaVersion: 1 as const,
    weddingDate: "2027-08-21",
    guestCount: 80,
    location: "Edinburgh",
    dateFlexibility: "fixed" as const,
    locationFlexible: false,
    priorities: ["venue", "photography"] as const,
    venueStyles: ["Castle"],
    photographyStyles: ["Documentary"],
    vision: "A relaxed day with our favourite people.",
  };
}

function savedProfile() {
  return {
    ...profileContent(),
    priorities: ["venue", "photography"] as Array<"venue" | "photography">,
    updatedAt,
  };
}

function routeContext() {
  return { params: Promise.resolve({ workspaceId }) };
}
