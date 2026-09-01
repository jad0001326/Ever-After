import {
  planningApiErrorResponse,
  planningApiResponseHeaders,
  readPlanningApiJson,
  resolvePlanningApiRequest,
} from "@/lib/planning-workspace/api-route";
import {
  planningBudgetResourceSchema,
  planningBudgetUpdateRequestSchema,
  planningBudgetUpdateSuccessSchema,
} from "@/lib/planning-workspace/budget-api-schema";
import { updatePlanningBudgetPlan } from "@/lib/planning-workspace/budget-api";
import { loadPlanningWorkspaceContext } from "@/lib/planning-workspace/server-snapshot";
import {
  getPaymentScheduleValidationFingerprint,
  validatePersistedPaymentSchedule,
} from "@everaft/planning-domain/budget/payment-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const budgetResourceContractId = "urn:everaft:planning-budget-resource:v1";
const budgetUpdateContractId = "urn:everaft:planning-budget-update-success:v1";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId: rawWorkspaceId } = await context.params;
  const api = await resolvePlanningApiRequest(
    request,
    rawWorkspaceId,
    budgetResourceContractId,
  );
  if (!api.ok) return api.response;

  const loaded = await loadPlanningWorkspaceContext(
    api.supabase,
    api.workspaceId,
    api.user.id,
    { includeSharing: false },
  ).catch(() => null);
  if (!loaded) {
    return planningApiErrorResponse(
      budgetResourceContractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!loaded.ok) {
    return planningApiErrorResponse(
      budgetResourceContractId,
      404,
      "workspace_unavailable",
    );
  }

  const resource = planningBudgetResourceSchema.parse({
    schemaVersion: 1,
    workspaceId: api.workspaceId,
    plan: loaded.budgetPlan,
    versions: {
      workspaceUpdatedAt: loaded.snapshot.workspace.updated_at,
      budgetUpdatedAt: loaded.budgetPlan.updatedAt,
    },
  });
  return Response.json(resource, {
    headers: planningApiResponseHeaders(budgetResourceContractId),
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
    budgetUpdateContractId,
  );
  if (!api.ok) return api.response;

  const body = await readPlanningApiJson(request, budgetUpdateContractId);
  if (!body.ok) return body.response;
  const updateRequest = planningBudgetUpdateRequestSchema.safeParse(body.data);
  if (!updateRequest.success) {
    return planningApiErrorResponse(budgetUpdateContractId, 400, "invalid_request");
  }

  const loaded = await loadPlanningWorkspaceContext(
    api.supabase,
    api.workspaceId,
    api.user.id,
    { includeSharing: false },
  ).catch(() => null);
  if (!loaded) {
    return planningApiErrorResponse(
      budgetUpdateContractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!loaded.ok) {
    return planningApiErrorResponse(
      budgetUpdateContractId,
      404,
      "workspace_unavailable",
    );
  }

  const { expectedBudgetUpdatedAt, plan } = updateRequest.data;
  if (
    plan.id !== loaded.budgetPlan.id
    || expectedBudgetUpdatedAt !== loaded.budgetPlan.updatedAt
  ) {
    return planningApiErrorResponse(budgetUpdateContractId, 409, "version_conflict");
  }

  const currentItems = new Map(
    loaded.budgetPlan.items.map((item) => [item.id, item]),
  );
  const hasInvalidPaymentChange = plan.items.some((item) => {
    const current = currentItems.get(item.id);
    if (
      current
      && getPaymentScheduleValidationFingerprint(current)
        === getPaymentScheduleValidationFingerprint(item)
    ) {
      return false;
    }
    return validatePersistedPaymentSchedule(item).length > 0;
  });
  if (hasInvalidPaymentChange) {
    return planningApiErrorResponse(budgetUpdateContractId, 400, "invalid_request");
  }

  const update = await updatePlanningBudgetPlan(
    api.supabase,
    loaded.snapshot.workspace.owner_id,
    plan,
    expectedBudgetUpdatedAt,
  ).catch(() => null);
  if (!update || (update.ok === false && update.reason === "unavailable")) {
    return planningApiErrorResponse(
      budgetUpdateContractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!update.ok) {
    return planningApiErrorResponse(budgetUpdateContractId, 409, "version_conflict");
  }

  const success = planningBudgetUpdateSuccessSchema.parse({
    schemaVersion: 1,
    budgetPlanId: update.budgetPlanId,
    savedAt: update.savedAt,
  });
  return Response.json(success, {
    headers: planningApiResponseHeaders(budgetUpdateContractId),
  });
}
