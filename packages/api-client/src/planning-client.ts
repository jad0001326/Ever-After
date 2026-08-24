import {
  planningWorkspaceCollectionSchema,
} from "@everaft/planning-contracts/planning-workspace/workspace-api-schema";
import {
  planningDashboardSnapshotSchema,
} from "@everaft/planning-contracts/planning-workspace/snapshot-schema";
import type { z } from "zod";

export type AccessTokenProvider = () => Promise<string | null>;

export type PlanningApiFailure =
  | "authentication_required"
  | "connected_planning_disabled"
  | "offline"
  | "planning_api_unavailable"
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

export function createPlanningApiClient(options: PlanningApiClientOptions) {
  const baseUrl = validateBaseUrl(options.baseUrl);
  const fetcher = options.fetch ?? globalThis.fetch;

  async function request<T>(
    operation: string,
    path: string,
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  ): Promise<T> {
    const token = await options.getAccessToken();
    if (!token) {
      return fail(operation, "authentication_required");
    }

    let response: Response;
    try {
      response = await fetcher(new URL(path, baseUrl), {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
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
  return "request_failed";
}
