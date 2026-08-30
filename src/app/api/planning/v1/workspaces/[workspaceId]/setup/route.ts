import {
  planningApiErrorResponse,
  planningApiResponseHeaders,
  readPlanningApiJson,
  resolvePlanningApiRequest,
} from "@/lib/planning-workspace/api-route";
import {
  planningConnectedPlanResourceSchema,
  planningSetupUpdateRequestSchema,
} from "@/lib/planning-workspace/connection-api-schema";
import { updatePlanningWorkspaceSetup } from "@/lib/planning-workspace/connection-api";
import { createPlanningConnectedPlanResource } from "@/lib/planning-workspace/connected-resource";
import { loadPlanningWorkspaceContext } from "@/lib/planning-workspace/server-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contractId = "urn:everaft:planning-connected-plan-resource:v1";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId: rawWorkspaceId } = await context.params;
  const api = await resolvePlanningApiRequest(request, rawWorkspaceId, contractId);
  if (!api.ok) return api.response;

  const body = await readPlanningApiJson(request, contractId, 64_000);
  if (!body.ok) return body.response;
  const parsed = planningSetupUpdateRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return planningApiErrorResponse(contractId, 400, "invalid_request");
  }

  const updated = await updatePlanningWorkspaceSetup(
    api.supabase,
    api.workspaceId,
    parsed.data,
  ).catch(() => null);
  if (!updated || (updated.ok === false && updated.reason === "unavailable")) {
    return planningApiErrorResponse(contractId, 503, "planning_api_unavailable");
  }
  if (!updated.ok) {
    const status = updated.reason === "too_large" ? 413
      : updated.reason === "invalid" ? 400
        : updated.reason === "not_found" ? 404
        : 409;
    const code = updated.reason === "too_large" ? "payload_too_large"
      : updated.reason === "invalid" ? "invalid_request"
        : updated.reason === "not_found" ? "workspace_unavailable"
        : "version_conflict";
    return planningApiErrorResponse(contractId, status, code);
  }

  const loaded = await loadPlanningWorkspaceContext(
    api.supabase,
    api.workspaceId,
    api.user.id,
    { includeSharing: false },
  ).catch(() => null);
  if (!loaded) {
    return planningApiErrorResponse(contractId, 503, "planning_api_unavailable");
  }
  if (!loaded.ok) {
    return planningApiErrorResponse(contractId, 404, "workspace_unavailable");
  }

  if (
    loaded.snapshot.workspace.updated_at !== updated.versions.workspaceUpdatedAt
    || loaded.budgetPlan.updatedAt !== updated.versions.budgetUpdatedAt
    || loaded.snapshot.profile?.updated_at !== updated.versions.profileUpdatedAt
  ) {
    return planningApiErrorResponse(contractId, 503, "planning_api_unavailable");
  }

  const resource = planningConnectedPlanResourceSchema.parse(
    createPlanningConnectedPlanResource(loaded),
  );
  return Response.json(resource, {
    headers: planningApiResponseHeaders(contractId),
  });
}
