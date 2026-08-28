import {
  planningWorkspaceCollectionSchema,
} from "@everaft/planning-contracts/planning-workspace/workspace-api-schema";
import {
  planningDashboardSnapshotSchema,
} from "@everaft/planning-contracts/planning-workspace/snapshot-schema";
import {
  planningBudgetResourceSchema,
  planningBudgetUpdateSuccessSchema,
  type PlanningBudgetUpdateRequest,
} from "@everaft/planning-contracts/planning-workspace/budget-api-schema";
import {
  planningConnectedPlanResourceSchema,
  type PlanningSetupUpdateRequest,
  type PlanningWorkspaceImportRequest,
} from "@everaft/planning-contracts/planning-workspace/connection-api-schema";
import {
  planningProfileResourceSchema,
} from "@everaft/planning-contracts/planning-workspace/profile-api-schema";
import type { z } from "zod";

export type AccessTokenProvider = () => Promise<string | null>;

export type PlanningApiFailure =
  | "authentication_required"
  | "connected_planning_disabled"
  | "offline"
  | "planning_api_unavailable"
  | "workspace_unavailable"
  | "version_conflict"
  | "payload_too_large"
  | "invalid_request"
  | "response_contract_invalid"
  | "request_failed";

export type PlanningApiDiagnostic = Readonly<{
  operation: string;
  outcome: "success" | "failure";
  status?: number;
  failure?: PlanningApiFailure;
}>;

export type PlanningApiClientOptions = Readonly<{
  baseUrl: string;
  getAccessToken: AccessTokenProvider;
  fetch?: typeof globalThis.fetch;
  onDiagnostic?: (diagnostic: PlanningApiDiagnostic) => void;
}>;

export class PlanningApiError extends Error {
  readonly failure: PlanningApiFailure;
  readonly status?: number;

  constructor(failure: PlanningApiFailure, status?: number) {
    super(failure);
    this.name = "PlanningApiError";
    this.failure = failure;
    this.status = status;
  }
}

export type PlanningWorkspaceCollection = z.infer<
  typeof planningWorkspaceCollectionSchema
>;
export type PlanningDashboardSnapshot = z.infer<
  typeof planningDashboardSnapshotSchema
>;
export type PlanningBudgetResource = z.infer<typeof planningBudgetResourceSchema>;
export type PlanningProfileResource = z.infer<typeof planningProfileResourceSchema>;
export type PlanningConnectedPlanResource = z.infer<
  typeof planningConnectedPlanResourceSchema
>;
export type PlanningWorkspaceHydration = Readonly<{
  dashboard: PlanningDashboardSnapshot;
  budget: PlanningBudgetResource;
  profile: PlanningProfileResource;
}>;

export function createPlanningApiClient(options: PlanningApiClientOptions) {
  const baseUrl = validateBaseUrl(options.baseUrl);
  const fetcher = options.fetch ?? globalThis.fetch;

  async function request<T>(
    operation: string,
    path: string,
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
    init?: Readonly<{ method: "POST" | "PATCH"; body: unknown }>,
  ): Promise<T> {
    const token = await options.getAccessToken();
    if (!token) {
      return fail(operation, "authentication_required");
    }

    let response: Response;
    try {
      response = await fetcher(new URL(path, baseUrl), {
        method: init?.method ?? "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(init ? { "Content-Type": "application/json" } : {}),
        },
        ...(init ? { body: JSON.stringify(init.body) } : {}),
      });
    } catch {
      return fail(operation, "offline");
    }

    if (!response.ok) {
      const serverCode = await readServerErrorCode(response);
      return fail(
        operation,
        mapFailure(response.status, serverCode),
        response.status,
      );
    }

    const payload = await response.json().catch(() => null);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return fail(operation, "response_contract_invalid", response.status);
    }
    options.onDiagnostic?.({ operation, outcome: "success", status: response.status });
    return parsed.data;
  }

  function fail(
    operation: string,
    failure: PlanningApiFailure,
    status?: number,
  ): never {
    options.onDiagnostic?.({ operation, outcome: "failure", failure, status });
    throw new PlanningApiError(failure, status);
  }

  return Object.freeze({
    listWorkspaces(limit = 25, offset = 0) {
      const query = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      return request(
        "planning.workspaces.list",
        `/api/planning/v1/workspaces?${query}`,
        planningWorkspaceCollectionSchema,
      );
    },
    getDashboard(workspaceId: string) {
      return request(
        "planning.dashboard.get",
        `/api/planning/v1/workspaces/${encodeURIComponent(workspaceId)}/dashboard`,
        planningDashboardSnapshotSchema,
      );
    },
    getBudget(workspaceId: string) {
      return request(
        "planning.budget.get",
        `/api/planning/v1/workspaces/${encodeURIComponent(workspaceId)}/budget`,
        planningBudgetResourceSchema,
      );
    },
    getProfile(workspaceId: string) {
      return request(
        "planning.profile.get",
        `/api/planning/v1/workspaces/${encodeURIComponent(workspaceId)}/profile`,
        planningProfileResourceSchema,
      );
    },
    updateBudget(workspaceId: string, body: PlanningBudgetUpdateRequest) {
      return request(
        "planning.budget.update",
        `/api/planning/v1/workspaces/${encodeURIComponent(workspaceId)}/budget`,
        planningBudgetUpdateSuccessSchema,
        { method: "PATCH", body },
      );
    },
    importWorkspace(body: PlanningWorkspaceImportRequest) {
      return request(
        "planning.workspace.import",
        "/api/planning/v1/workspaces/import",
        planningConnectedPlanResourceSchema,
        { method: "POST", body },
      );
    },
    updateSetup(workspaceId: string, body: PlanningSetupUpdateRequest) {
      return request(
        "planning.setup.update",
        `/api/planning/v1/workspaces/${encodeURIComponent(workspaceId)}/setup`,
        planningConnectedPlanResourceSchema,
        { method: "PATCH", body },
      );
    },
    async hydrateWorkspace(workspaceId: string) {
      const encoded = encodeURIComponent(workspaceId);
      const [dashboard, budget, profile] = await Promise.all([
        request(
          "planning.dashboard.get",
          `/api/planning/v1/workspaces/${encoded}/dashboard`,
          planningDashboardSnapshotSchema,
        ),
        request(
          "planning.budget.get",
          `/api/planning/v1/workspaces/${encoded}/budget`,
          planningBudgetResourceSchema,
        ),
        request(
          "planning.profile.get",
          `/api/planning/v1/workspaces/${encoded}/profile`,
          planningProfileResourceSchema,
        ),
      ]);
      return { dashboard, budget, profile } satisfies PlanningWorkspaceHydration;
    },
  });
}

function validateBaseUrl(raw: string) {
  const url = new URL(raw);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error("Planning API base URL must use HTTPS outside localhost.");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

async function readServerErrorCode(response: Response) {
  const payload = await response.clone().json().catch(() => null) as {
    error?: unknown;
  } | null;
  return typeof payload?.error === "string" ? payload.error : null;
}

function mapFailure(status: number, serverCode: string | null): PlanningApiFailure {
  if (status === 401) return "authentication_required";
  if (status === 503 && serverCode === "connected_planning_disabled") {
    return "connected_planning_disabled";
  }
  if (status === 503) return "planning_api_unavailable";
  if (status === 404) return "workspace_unavailable";
  if (status === 409) return "version_conflict";
  if (status === 413) return "payload_too_large";
  if (status === 400) return "invalid_request";
  return "request_failed";
}
