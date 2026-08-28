import {
  planningApiErrorResponse,
  planningApiResponseHeaders,
  readPlanningApiJson,
  resolvePlanningApiAuthentication,
} from "@/lib/planning-workspace/api-route";
import {
  planningConnectedPlanResourceSchema,
  planningWorkspaceImportRequestSchema,
} from "@/lib/planning-workspace/connection-api-schema";
import { importPlanningWorkspaceConnection } from "@/lib/planning-workspace/connection-api";
import { createPlanningConnectedPlanResource } from "@/lib/planning-workspace/connected-resource";
import { loadPlanningWorkspaceContext } from "@/lib/planning-workspace/server-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contractId = "urn:everaft:planning-connected-plan-resource:v1";

export async function POST(request: Request) {
  const api = await resolvePlanningApiAuthentication(request, contractId);
  if (!api.ok) return api.response;

  const body = await readPlanningApiJson(request, contractId);
  if (!body.ok) return body.response;
  const parsed = planningWorkspaceImportRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return planningApiErrorResponse(contractId, 400, "invalid_request");
  }

  const imported = await importPlanningWorkspaceConnection(
    api.supabase,
    api.user.id,
    parsed.data,
  ).catch(() => null);
  if (!imported || (imported.ok === false && imported.reason === "unavailable")) {
    return planningApiErrorResponse(contractId, 503, "planning_api_unavailable");
  }
  if (!imported.ok) {
    const status = imported.reason === "too_large" ? 413
      : imported.reason === "invalid" ? 400
        : imported.reason === "not_found" ? 404
        : 409;
    const code = imported.reason === "too_large" ? "payload_too_large"
      : imported.reason === "invalid" ? "invalid_request"
        : imported.reason === "not_found" ? "workspace_unavailable"
        : "version_conflict";
    return planningApiErrorResponse(contractId, status, code);
  }

  const loaded = await loadPlanningWorkspaceContext(
    api.supabase,
    imported.workspaceId,
    api.user.id,
    { includeSharing: false },
  ).catch(() => null);
  if (!loaded || !loaded.ok) {
    return planningApiErrorResponse(contractId, 503, "planning_api_unavailable");
  }

  const resource = planningConnectedPlanResourceSchema.parse(
    createPlanningConnectedPlanResource(loaded),
  );
  return Response.json(resource, {
    status: parsed.data.targetWorkspaceId ? 200 : 201,
    headers: planningApiResponseHeaders(contractId),
  });
}
