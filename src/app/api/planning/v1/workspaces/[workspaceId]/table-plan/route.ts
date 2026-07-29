import {
  planningApiErrorResponse,
  planningApiResponseHeaders,
  readPlanningApiJson,
  resolvePlanningApiRequest,
} from "@/lib/planning-workspace/api-route";
import {
  planningTablePlanResourceSchema,
  planningTablePlanUpdateRequestSchema,
  planningTablePlanUpdateSuccessSchema,
} from "@/lib/planning-workspace/table-plan-api-schema";
import {
  loadPlanningTablePlan,
  syncPlanningTablePlan,
} from "@/lib/planning-workspace/table-plan-api";
import { loadPlanningWorkspaceVersion } from "@/lib/planning-workspace/server-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resourceContractId = "urn:everaft:planning-table-plan-resource:v1";
const updateContractId =
  "urn:everaft:planning-table-plan-update-success:v1";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId: rawWorkspaceId } = await context.params;
  const api = await resolvePlanningApiRequest(
    request,
    rawWorkspaceId,
    resourceContractId,
  );
  if (!api.ok) return api.response;

  const loaded = await loadPlanningTablePlan(
    api.supabase,
    api.workspaceId,
  ).catch(() => null);
  if (!loaded) {
    return planningApiErrorResponse(
      resourceContractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!loaded.ok && loaded.reason === "not_found") {
    return planningApiErrorResponse(
      resourceContractId,
      404,
      "workspace_unavailable",
    );
  }
  if (!loaded.ok && loaded.reason === "invalid") {
    return planningApiErrorResponse(
      resourceContractId,
      500,
      "table_plan_unavailable",
    );
  }
  if (!loaded.ok) {
    return planningApiErrorResponse(
      resourceContractId,
      503,
      "planning_api_unavailable",
    );
  }
  const resource = planningTablePlanResourceSchema.safeParse(loaded.resource);
  if (!resource.success) {
    return planningApiErrorResponse(
      resourceContractId,
      500,
      "table_plan_unavailable",
    );
  }
  return Response.json(resource.data, {
    headers: planningApiResponseHeaders(resourceContractId),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId: rawWorkspaceId } = await context.params;
  const api = await resolvePlanningApiRequest(
    request,
    rawWorkspaceId,
    updateContractId,
  );
  if (!api.ok) return api.response;

  const body = await readPlanningApiJson(request, updateContractId);
  if (!body.ok) return body.response;
  const updateRequest = planningTablePlanUpdateRequestSchema.safeParse(
    body.data,
  );
  if (!updateRequest.success) {
    return planningApiErrorResponse(
      updateContractId,
      400,
      "invalid_request",
    );
  }

  const version = await loadPlanningWorkspaceVersion(
    api.supabase,
    api.workspaceId,
  ).catch(() => null);
  if (!version) {
    return planningApiErrorResponse(
      updateContractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!version.ok) {
    return planningApiErrorResponse(
      updateContractId,
      404,
      "workspace_unavailable",
    );
  }

  const { expectedWorkspaceUpdatedAt, tablePlan } = updateRequest.data;
  if (expectedWorkspaceUpdatedAt !== version.updatedAt) {
    return planningApiErrorResponse(
      updateContractId,
      409,
      "version_conflict",
    );
  }

  const sync = await syncPlanningTablePlan(
    api.supabase,
    api.workspaceId,
    tablePlan,
    expectedWorkspaceUpdatedAt,
  ).catch(() => null);
  if (!sync || (sync.ok === false && sync.reason === "unavailable")) {
    return planningApiErrorResponse(
      updateContractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!sync.ok) {
    return planningApiErrorResponse(
      updateContractId,
      409,
      "version_conflict",
    );
  }

  const success = planningTablePlanUpdateSuccessSchema.parse({
    schemaVersion: 1,
    workspaceId: sync.workspaceId,
    savedAt: sync.savedAt,
  });
  return Response.json(success, {
    headers: planningApiResponseHeaders(updateContractId),
  });
}
