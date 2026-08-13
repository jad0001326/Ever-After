import { describe, expect, it, vi } from "vitest";
import { loadPlanningProfile, savePlanningProfile } from "./profile-api";

const workspaceId = "60000000-0000-4000-8000-000000000006";
const updatedAt = "2026-07-29T12:00:00.000Z";

describe("Planning Profile API persistence", () => {
  it("loads only the caller-visible profile and maps database columns", async () => {
    const query = terminalQuery({ data: profileRow(), error: null });
    const from = vi.fn(() => query);

    const result = await loadPlanningProfile({ from } as never, workspaceId);

    expect(result).toEqual({
      ok: true,
      profile: {
        ...profileContent(),
        updatedAt,
      },
    });
    expect(from).toHaveBeenCalledWith("planning_workspace_profiles");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
  });

  it("returns a nullable resource when an accessible workspace has no profile", async () => {
    const query = terminalQuery({ data: null, error: null });

    await expect(loadPlanningProfile(
      { from: vi.fn(() => query) } as never,
      workspaceId,
    )).resolves.toEqual({ ok: true, profile: null });
  });

  it("creates a profile without accepting a client version or identity field", async () => {
    const query = insertQuery({ data: profileRow(), error: null });

    const result = await savePlanningProfile(
      { from: vi.fn(() => query) } as never,
      workspaceId,
      profileContent(),
      null,
    );

    expect(result).toEqual({
      ok: true,
      profile: { ...profileContent(), updatedAt },
    });
    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      wedding_date: "2027-08-21",
      guest_count: 80,
      location: "Edinburgh",
      date_flexibility: "fixed",
      location_flexible: false,
      priorities: ["venue", "photography"],
      venue_styles: ["Castle"],
      photography_styles: ["Documentary"],
      vision: "A relaxed day with our favourite people.",
    });
    expect(query.insert.mock.calls[0][0]).not.toHaveProperty("updated_at");
    expect(query.insert.mock.calls[0][0]).not.toHaveProperty("owner_id");
  });

  it("updates only the exact workspace profile version", async () => {
    const query = updateQuery({
      data: profileRow({ updated_at: "2026-07-29T12:00:00.001Z" }),
      error: null,
    });

    const result = await savePlanningProfile(
      { from: vi.fn(() => query) } as never,
      workspaceId,
      profileContent(),
      updatedAt,
    );

    expect(result).toEqual({
      ok: true,
      profile: {
        ...profileContent(),
        updatedAt: "2026-07-29T12:00:00.001Z",
      },
    });
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(query.eq).toHaveBeenCalledWith("updated_at", updatedAt);
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("workspace_id");
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("updated_at");
  });

  it("maps create collisions and zero-row updates to version conflicts", async () => {
    const create = insertQuery({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });
    const update = updateQuery({ data: null, error: null });

    await expect(savePlanningProfile(
      { from: vi.fn(() => create) } as never,
      workspaceId,
      profileContent(),
      null,
    )).resolves.toEqual({ ok: false, reason: "version_conflict" });
    await expect(savePlanningProfile(
      { from: vi.fn(() => update) } as never,
      workspaceId,
      profileContent(),
      updatedAt,
    )).resolves.toEqual({ ok: false, reason: "version_conflict" });
  });

  it("keeps Data API errors distinct from conflicts", async () => {
    const query = updateQuery({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });

    await expect(savePlanningProfile(
      { from: vi.fn(() => query) } as never,
      workspaceId,
      profileContent(),
      updatedAt,
    )).resolves.toEqual({ ok: false, reason: "unavailable" });
  });
});

function terminalQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function insertQuery(result: { data: unknown; error: unknown }) {
  const query = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(async () => result),
  };
  query.insert.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

function updateQuery(result: { data: unknown; error: unknown }) {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

function profileContent() {
  return {
    schemaVersion: 1 as const,
    weddingDate: "2027-08-21",
    guestCount: 80,
    location: "Edinburgh",
    dateFlexibility: "fixed" as const,
    locationFlexible: false,
    priorities: ["venue", "photography"] as Array<"venue" | "photography">,
    venueStyles: ["Castle"],
    photographyStyles: ["Documentary"],
    vision: "A relaxed day with our favourite people.",
  };
}

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    workspace_id: workspaceId,
    wedding_date: "2027-08-21",
    guest_count: 80,
    location: "Edinburgh",
    date_flexibility: "fixed",
    location_flexible: false,
    priorities: ["venue", "photography"],
    venue_styles: ["Castle"],
    photography_styles: ["Documentary"],
    vision: "A relaxed day with our favourite people.",
    updated_at: updatedAt,
    ...overrides,
  };
}
