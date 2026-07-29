import { planningWorkspaceFromCloud } from "@/lib/planning-workspace/cloud";
import {
  planningApiErrorResponse,
  planningApiResponseHeaders,
  resolvePlanningApiRequest,
} from "@/lib/planning-workspace/api-route";
import {
  planningDashboardSnapshotSchema,
} from "@/lib/planning-workspace/snapshot-schema";
import { createPlanningDashboardSnapshot } from "@/lib/planning-workspace/snapshot";
import { loadPlanningWorkspaceContext } from "@/lib/planning-workspace/server-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contractId = "urn:everaft:planning-dashboard-snapshot:v1";

export async function GET(
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

  try {
    const snapshot = createPlanningDashboardSnapshot(
      loaded.budgetPlan,
      planningWorkspaceFromCloud(loaded.snapshot),
    );
    const validated = planningDashboardSnapshotSchema.parse(snapshot);
    return Response.json(validated, {
      headers: planningApiResponseHeaders(contractId),
    });
  } catch {
    return planningApiErrorResponse(
      contractId,
      500,
      "snapshot_unavailable",
    );
  }
}
