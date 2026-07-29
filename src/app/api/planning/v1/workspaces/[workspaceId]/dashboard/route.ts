import { planningWorkspaceFromCloud } from "@/lib/planning-workspace/cloud";
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
import {
  planningDashboardSnapshotSchema,
} from "@/lib/planning-workspace/snapshot-schema";
import { createPlanningDashboardSnapshot } from "@/lib/planning-workspace/snapshot";
import { loadPlanningWorkspaceContext } from "@/lib/planning-workspace/server-snapshot";
import { planningWorkspaceIdSchema } from "@/lib/planning-workspace/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Authorization",
  "X-Content-Type-Options": "nosniff",
  "X-EverAft-Contract": "urn:everaft:planning-dashboard-snapshot:v1",
};

function errorResponse(
  status: number,
  code: string,
  extraHeaders: Record<string, string> = {},
) {
  return Response.json(
    { error: code },
    {
      status,
      headers: {
        ...responseHeaders,
        ...extraHeaders,
      },
    },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  if (process.env.PLANNING_WORKSPACE_CLOUD_ENABLED !== "true") {
    return errorResponse(503, "connected_planning_disabled");
  }

  const { workspaceId: rawWorkspaceId } = await context.params;
  const workspaceId = planningWorkspaceIdSchema.safeParse(rawWorkspaceId);
  if (!workspaceId.success) {
    return errorResponse(400, "invalid_workspace_id");
  }

  const authentication = await authenticatePlanningApiRequest(request);
  if (!authentication.ok) {
    if (
      authentication.reason === "server_not_configured"
      || authentication.reason === "authentication_unavailable"
    ) {
      return errorResponse(503, "planning_api_unavailable");
    }
    return errorResponse(401, "authentication_required", {
      "WWW-Authenticate": 'Bearer realm="EverAft Planning API"',
    });
  }

  const loaded = await loadPlanningWorkspaceContext(
    authentication.supabase,
    workspaceId.data,
    authentication.user.id,
    { includeSharing: false },
  ).catch(() => null);
  if (!loaded) {
    return errorResponse(503, "planning_api_unavailable");
  }
  if (!loaded.ok) {
    return errorResponse(404, "workspace_unavailable");
  }

  try {
    const snapshot = createPlanningDashboardSnapshot(
      loaded.budgetPlan,
      planningWorkspaceFromCloud(loaded.snapshot),
    );
    const validated = planningDashboardSnapshotSchema.parse(snapshot);
    return Response.json(validated, { headers: responseHeaders });
  } catch {
    return errorResponse(500, "snapshot_unavailable");
  }
}
