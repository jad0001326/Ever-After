import { describe, expect, it, vi } from "vitest";
import { createPlanningHubStarterPlan } from "@everaft/planning-domain/planning-hub/plan";
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

  it("sends typed writes without exposing their token or body in diagnostics", async () => {
    const diagnostics: unknown[] = [];
    const success = {
      schemaVersion: 1,
      budgetPlanId: "plan-1",
      savedAt: "2026-08-22T10:00:00.001Z",
    };
    const fetcher = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => Response.json(success));
    const client = createPlanningApiClient({
      baseUrl: "https://example.test",
      getAccessToken: async () => "private-token",
      fetch: fetcher,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    const body = {
      schemaVersion: 1 as const,
      expectedBudgetUpdatedAt: "2026-08-22T10:00:00.000Z",
      plan: {
        ...createPlanningHubStarterPlan("user-1"),
        id: "plan-1",
        updatedAt: "2026-08-22T10:00:00.000Z",
      },
    };

    await expect(client.updateBudget("workspace-1", body)).resolves.toEqual(success);
    const [, init] = fetcher.mock.calls[0];
    expect(init?.method).toBe("PATCH");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify(body));
    expect(JSON.stringify(diagnostics)).not.toContain("private-token");
    expect(JSON.stringify(diagnostics)).not.toContain("plan-1");
  });

  it.each([
    [401, "authentication_required", "authentication_required"],
    [503, "connected_planning_disabled", "connected_planning_disabled"],
    [503, "planning_api_unavailable", "planning_api_unavailable"],
    [404, "workspace_unavailable", "workspace_unavailable"],
    [404, "task_unavailable", "task_unavailable"],
    [409, "version_conflict", "version_conflict"],
    [413, "payload_too_large", "payload_too_large"],
    [400, "invalid_request", "invalid_request"],
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

  it("supports bounded task reads and typed create, update and delete writes", async () => {
    const task = taskResource();
    const responses = [
      Response.json({
        schemaVersion: 1,
        workspaceId: task.workspaceId,
        tasks: [task],
        page: { limit: 25, offset: 50, hasMore: false },
      }),
      Response.json(task),
      Response.json(task, { status: 201 }),
      Response.json({ ...task, status: "done" }),
      Response.json({ schemaVersion: 1, taskId: task.id, deleted: true }),
    ];
    const fetcher = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => responses.shift()!);
    const client = createPlanningApiClient({
      baseUrl: "https://example.test",
      getAccessToken: async () => "fixture-token",
      fetch: fetcher,
    });

    await client.listTasks(task.workspaceId, 25, 50);
    await client.getTask(task.workspaceId, task.id);
    await client.createTask(task.workspaceId, {
      schemaVersion: 1,
      task: taskContent(task),
    });
    await client.updateTask(task.workspaceId, task.id, {
      schemaVersion: 1,
      expectedTaskUpdatedAt: task.updatedAt,
      changes: { status: "done" },
    });
    await client.deleteTask(task.workspaceId, task.id, {
      schemaVersion: 1,
      expectedTaskUpdatedAt: task.updatedAt,
    });

    expect(String(fetcher.mock.calls[0][0])).toContain("limit=25&offset=50");
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual([
      "GET", "GET", "POST", "PATCH", "DELETE",
    ]);
  });

  it("rejects cleartext non-local API origins", () => {
    expect(() => createPlanningApiClient({
      baseUrl: "http://example.test",
      getAccessToken: async () => null,
    })).toThrow(/HTTPS/);
  });
});

function taskResource() {
  return {
    schemaVersion: 1 as const,
    id: "70000000-0000-4000-8000-000000000007",
    workspaceId: "60000000-0000-4000-8000-000000000006",
    title: "Confirm final guest numbers",
    notes: null,
    category: "guests" as const,
    status: "todo" as const,
    dueDate: "2027-07-01",
    sortOrder: 3,
    createdAt: "2026-08-22T10:00:00.000Z",
    updatedAt: "2026-08-22T10:00:00.000Z",
  };
}

function taskContent(task: ReturnType<typeof taskResource>) {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    category: task.category,
    status: task.status,
    dueDate: task.dueDate,
    sortOrder: task.sortOrder,
  };
}
