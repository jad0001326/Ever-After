// @vitest-environment node

import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  loadPlanningApiContractSchemas,
  planningApiContracts,
  planningApiRequest,
  validatePlanningApiContract,
} from "./planning-api-http.mjs";

const sourceRoot = join(import.meta.dirname, "..", "..");

describe("Planning API checked HTTP verifier", () => {
  it("loads the committed schemas and rejects an invalid response", async () => {
    const schemas = await loadPlanningApiContractSchemas(sourceRoot);
    expect(schemas.size).toBe(15);
    expect(() => validatePlanningApiContract(
      schemas,
      planningApiContracts.workspaceCollection,
      { schemaVersion: 1, workspaces: [] },
      "Workspace collection",
    )).toThrow(/does not match/);
  });

  it("checks status, security headers and the success contract", async () => {
    const schemas = await loadPlanningApiContractSchemas(sourceRoot);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      schemaVersion: 1,
      workspaces: [],
      page: { limit: 25, offset: 0, hasMore: false },
    }), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": "application/json",
        "Vary": "Authorization",
        "X-Content-Type-Options": "nosniff",
        "X-EverAft-Contract": planningApiContracts.workspaceCollection,
      },
    }));

    await expect(planningApiRequest({
      appUrl: "http://127.0.0.1:3000",
      contractId: planningApiContracts.workspaceCollection,
      fetchImpl,
      label: "Workspace collection",
      path: "/api/planning/v1/workspaces",
      schemas,
      token: "test-token",
    })).resolves.toMatchObject({ schemaVersion: 1 });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:3000/api/planning/v1/workspaces"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });

  it("checks the exact error payload without applying a success schema", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ error: "authentication_required" }),
      {
        status: 401,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Type": "application/json",
          "Vary": "Authorization",
          "X-Content-Type-Options": "nosniff",
          "X-EverAft-Contract": planningApiContracts.workspaceCollection,
        },
      },
    ));
    await expect(planningApiRequest({
      appUrl: "http://localhost:3000",
      contractId: planningApiContracts.workspaceCollection,
      expectedError: "authentication_required",
      expectedStatus: 401,
      fetchImpl,
      label: "Rejected session",
      path: "/api/planning/v1/workspaces",
      schemas: new Map(),
    })).resolves.toEqual({ error: "authentication_required" });
  });
});
