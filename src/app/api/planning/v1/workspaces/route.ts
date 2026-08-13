import {
  planningApiErrorResponse,
  planningApiResponseHeaders,
  resolvePlanningApiAuthentication,
} from "@/lib/planning-workspace/api-route";
import { listPlanningWorkspaces } from "@/lib/planning-workspace/workspace-api";
import { planningWorkspaceCollectionSchema } from "@/lib/planning-workspace/workspace-api-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contractId = "urn:everaft:planning-workspace-collection:v1";

export async function GET(request: Request) {
  const api = await resolvePlanningApiAuthentication(request, contractId);
  if (!api.ok) return api.response;

  const page = parsePage(request);
  if (!page) {
    return planningApiErrorResponse(
      contractId,
      400,
      "invalid_pagination",
    );
  }

  const result = await listPlanningWorkspaces(
    api.supabase,
    api.user.id,
    page.offset,
    page.limit,
  ).catch(() => null);
  if (
    !result
    || (result.ok === false && result.reason === "unavailable")
  ) {
    return planningApiErrorResponse(
      contractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!result.ok) {
    return planningApiErrorResponse(
      contractId,
      500,
      "workspace_collection_unavailable",
    );
  }

  const collection = planningWorkspaceCollectionSchema.parse({
    schemaVersion: 1,
    workspaces: result.workspaces,
    page: {
      ...page,
      hasMore: result.hasMore,
    },
  });
  return Response.json(collection, {
    headers: planningApiResponseHeaders(contractId),
  });
}

function parsePage(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const rawLimit = searchParams.get("limit") ?? "25";
  const rawOffset = searchParams.get("offset") ?? "0";
  if (!/^\d+$/.test(rawLimit) || !/^\d+$/.test(rawOffset)) return null;
  const limit = Number(rawLimit);
  const offset = Number(rawOffset);
  if (
    !Number.isSafeInteger(limit)
    || limit < 1
    || limit > 50
    || !Number.isSafeInteger(offset)
    || offset < 0
    || offset > 100000
  ) {
    return null;
  }
  return { limit, offset };
}
