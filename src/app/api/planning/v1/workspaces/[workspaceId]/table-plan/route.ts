import {
  planningApiErrorResponse,
  planningApiResponseHeaders,
  readPlanningApiJson,
  resolvePlanningApiRequest,
} from "@/lib/planning-workspace/api-route";
import {
  planningTablePlanUpdateRequestSchema,
  planningTablePlanUpdateSuccessSchema,
} from "@/lib/planning-workspace/table-plan-api-schema";
import { syncPlanningTablePlan } from "@/lib/planning-workspace/table-plan-api";
import { loadPlanningWorkspaceVersion } from "@/lib/planning-workspace/server-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contractId = "urn:everaft:planning-table-plan-update-success:v1";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId: rawWorkspaceId } = await context.params;
  const api = await resolvePlanningApiRequest(
    request,
    rawWorkspaceId,
    contractId,
  );
  if (!api.ok) return api.response;

  const body = await readPlanningApiJson(request, contractId);
  if (!body.ok) return body.response;
  const updateRequest = planningTablePlanUpdateRequestSchema.safeParse(
    body.data,
  );
  if (!updateRequest.success) {
    return planningApiErrorResponse(contractId, 400, "invalid_request");
  }

  const version = await loadPlanningWorkspaceVersion(
    api.supabase,
    api.workspaceId,
  ).catch(() => null);
  if (!version) {
    return planningApiErrorResponse(
      contractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!version.ok) {
    return planningApiErrorResponse(
      contractId,
      404,
      "workspace_unavailable",
    );
  }

  const { expectedWorkspaceUpdatedAt, tablePlan } = updateRequest.data;
  if (expectedWorkspaceUpdatedAt !== version.updatedAt) {
    return planningApiErrorResponse(contractId, 409, "version_conflict");
  }

  const sync = await syncPlanningTablePlan(
    api.supabase,
    api.workspaceId,
    tablePlan,
    expectedWorkspaceUpdatedAt,
  ).catch(() => null);
  if (!sync || (sync.ok === false && sync.reason === "unavailable")) {
    return planningApiErrorResponse(
      contractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!sync.ok) {
    return planningApiErrorResponse(contractId, 409, "version_conflict");
  }

  const success = planningTablePlanUpdateSuccessSchema.parse({
    schemaVersion: 1,
    workspaceId: sync.workspaceId,
    savedAt: sync.savedAt,
  });
  return Response.json(success, {
    headers: planningApiResponseHeaders(contractId),
  });
}
