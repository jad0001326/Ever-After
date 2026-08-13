import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { authenticatePlanningApiRequest } from "./api-auth";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/config", () => ({
  supabaseUrl: "https://project.supabase.co",
  supabasePublishableKey: "publishable-key",
}));

describe("Planning API bearer authentication", () => {
  afterEach(() => {
    vi.mocked(createClient).mockReset();
  });

  it("rejects a missing bearer token without creating a client", async () => {
    const result = await authenticatePlanningApiRequest(
      new Request("https://www.everaft.co.uk/api/planning/v1/workspaces"),
    );

    expect(result).toEqual({ ok: false, reason: "missing_bearer" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects malformed and unreasonably large authorization values", async () => {
    const malformed = await authenticatePlanningApiRequest(new Request(
      "https://www.everaft.co.uk/api/planning/v1/workspaces",
      { headers: { Authorization: "Basic abc" } },
    ));
    const oversized = await authenticatePlanningApiRequest(new Request(
      "https://www.everaft.co.uk/api/planning/v1/workspaces",
      { headers: { Authorization: `Bearer ${"a".repeat(8193)}` } },
    ));

    expect(malformed).toEqual({ ok: false, reason: "invalid_bearer" });
    expect(oversized).toEqual({ ok: false, reason: "invalid_bearer" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("verifies the access token with Supabase Auth", async () => {
    const getUser = vi.fn(async () => ({
      data: { user: { id: "partner-1" } },
      error: null,
    }));
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser },
    } as never);

    const result = await authenticatePlanningApiRequest(new Request(
      "https://www.everaft.co.uk/api/planning/v1/workspaces",
      { headers: { Authorization: "bearer signed-user-token" } },
    ));

    expect(result).toMatchObject({
      ok: true,
      user: { id: "partner-1" },
    });
    expect(getUser).toHaveBeenCalledWith("signed-user-token");
    expect(createClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "publishable-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            Authorization: "Bearer signed-user-token",
          },
        },
      },
    );
  });

  it("rejects a token that Supabase Auth cannot verify", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: { message: "invalid token" },
        })),
      },
    } as never);

    const result = await authenticatePlanningApiRequest(new Request(
      "https://www.everaft.co.uk/api/planning/v1/workspaces",
      { headers: { Authorization: "Bearer rejected-token" } },
    ));

    expect(result).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("reports a temporary authentication outage without throwing", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => {
          throw new Error("network unavailable");
        }),
      },
    } as never);

    const result = await authenticatePlanningApiRequest(new Request(
      "https://www.everaft.co.uk/api/planning/v1/workspaces",
      { headers: { Authorization: "Bearer temporarily-unverifiable-token" } },
    ));

    expect(result).toEqual({
      ok: false,
      reason: "authentication_unavailable",
    });
  });
});
