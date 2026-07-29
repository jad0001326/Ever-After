import {
  planningApiErrorResponse,
  planningApiResponseHeaders,
  resolvePlanningApiRequest,
} from "@/lib/planning-workspace/api-route";
import {
  planningBudgetUpdateRequestSchema,
  planningBudgetUpdateSuccessSchema,
} from "@/lib/planning-workspace/budget-api-schema";
import { updatePlanningBudgetPlan } from "@/lib/planning-workspace/budget-api";
import { loadPlanningWorkspaceContext } from "@/lib/planning-workspace/server-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contractId = "urn:everaft:planning-budget-update-success:v1";
const maxBodyBytes = 1_000_000;

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

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return planningApiErrorResponse(
      contractId,
      415,
      "unsupported_media_type",
    );
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    return planningApiErrorResponse(contractId, 413, "payload_too_large");
  }

  const rawBody = await request.text().catch(() => null);
  if (
    rawBody === null
    || new TextEncoder().encode(rawBody).byteLength > maxBodyBytes
  ) {
    return planningApiErrorResponse(contractId, 413, "payload_too_large");
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return planningApiErrorResponse(contractId, 400, "invalid_request");
  }
  const updateRequest = planningBudgetUpdateRequestSchema.safeParse(json);
  if (!updateRequest.success) {
    return planningApiErrorResponse(contractId, 400, "invalid_request");
  }

  const loaded = await loadPlanningWorkspaceContext(
    api.supabase,
    api.workspaceId,
    api.user.id,
    { includeSharing: false },
  ).catch(() => null);
  if (!loaded) {
    return planningApiErrorResponse(
      contractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!loaded.ok) {
    return planningApiErrorResponse(
      contractId,
      404,
      "workspace_unavailable",
    );
  }

  const { expectedBudgetUpdatedAt, plan } = updateRequest.data;
  if (
    plan.id !== loaded.budgetPlan.id
    || expectedBudgetUpdatedAt !== loaded.budgetPlan.updatedAt
  ) {
    return planningApiErrorResponse(contractId, 409, "version_conflict");
  }

  const update = await updatePlanningBudgetPlan(
    api.supabase,
    loaded.snapshot.workspace.owner_id,
    plan,
    expectedBudgetUpdatedAt,
  ).catch(() => null);
  if (!update || (update.ok === false && update.reason === "unavailable")) {
    return planningApiErrorResponse(
      contractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!update.ok) {
    return planningApiErrorResponse(contractId, 409, "version_conflict");
  }

  const success = planningBudgetUpdateSuccessSchema.parse({
    schemaVersion: 1,
    budgetPlanId: update.budgetPlanId,
    savedAt: update.savedAt,
  });
  return Response.json(success, {
    headers: planningApiResponseHeaders(contractId),
  });
}
