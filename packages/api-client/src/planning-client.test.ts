import { describe, expect, it, vi } from "vitest";
import { PlanningApiError, createPlanningApiClient } from "./planning-client";

const workspaceCollection = {
  schemaVersion: 1,
  workspaces: [{
    schemaVersion: 1,
    id: "11111111-1111-4111-8111-111111111111",
    name: "Our wedding",
    budgetPlanId: "plan-1",
    role: "owner",
    createdAt: "2026-08-22T10:00:00.000Z",
    updatedAt: "2026-08-22T10:00:00.000Z",
  }],
  page: { limit: 25, offset: 0, hasMore: false },
};

describe("createPlanningApiClient", () => {
  it("adds the bearer token and validates the workspace contract", async () => {
    const fetcher = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => Response.json(workspaceCollection));
    const client = createPlanningApiClient({
      baseUrl: "https://example.test",
      getAccessToken: async () => "fixture-token",
      fetch: fetcher,
    });

    await expect(client.listWorkspaces()).resolves.toEqual(workspaceCollection);
    const [, init] = fetcher.mock.calls[0];
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fixture-token");
  });

  it.each([
    [401, "authentication_required", "authentication_required"],
    [503, "connected_planning_disabled", "connected_planning_disabled"],
    [503, "planning_api_unavailable", "planning_api_unavailable"],
  ] as const)("maps %s %s without exposing the token", async (status, code, expected) => {
    const diagnostics: unknown[] = [];
    const client = createPlanningApiClient({
      baseUrl: "https://example.test",
      getAccessToken: async () => "do-not-log-this-token",
      fetch: async () => Response.json({ error: code }, { status }),
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    await expect(client.listWorkspaces()).rejects.toMatchObject({ failure: expected });
    expect(JSON.stringify(diagnostics)).not.toContain("do-not-log-this-token");
  });

  it("reports offline and invalid-contract responses distinctly", async () => {
    const offline = createPlanningApiClient({
      baseUrl: "https://example.test",
      getAccessToken: async () => "fixture-token",
      fetch: async () => { throw new TypeError("Network request failed"); },
    });
    await expect(offline.listWorkspaces()).rejects.toEqual(
      expect.objectContaining({ failure: "offline" }),
    );

    const invalid = createPlanningApiClient({
      baseUrl: "https://example.test",
      getAccessToken: async () => "fixture-token",
      fetch: async () => Response.json({ schemaVersion: 99 }),
    });
    await expect(invalid.listWorkspaces()).rejects.toEqual(
      expect.objectContaining({ failure: "response_contract_invalid" }),
    );
  });

  it("fails before fetching when there is no authenticated session", async () => {
    const fetcher = vi.fn();
    const client = createPlanningApiClient({
      baseUrl: "https://example.test",
      getAccessToken: async () => null,
      fetch: fetcher,
    });
    await expect(client.listWorkspaces()).rejects.toBeInstanceOf(PlanningApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects cleartext non-local API origins", () => {
    expect(() => createPlanningApiClient({
      baseUrl: "http://example.test",
      getAccessToken: async () => null,
    })).toThrow(/HTTPS/);
  });
});
