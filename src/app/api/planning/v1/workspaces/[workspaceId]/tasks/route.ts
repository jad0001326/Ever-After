import {
  planningApiErrorResponse,
  planningApiResponseHeaders,
  readPlanningApiJson,
  resolvePlanningApiRequest,
} from "@/lib/planning-workspace/api-route";
import {
  createPlanningTask,
  listPlanningTasks,
} from "@/lib/planning-workspace/task-api";
import {
  planningTaskCollectionSchema,
  planningTaskCreateRequestSchema,
  planningTaskResourceSchema,
} from "@/lib/planning-workspace/task-api-schema";
import { loadPlanningWorkspaceVersion } from "@/lib/planning-workspace/server-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const collectionContractId = "urn:everaft:planning-task-collection:v1";
const resourceContractId = "urn:everaft:planning-task-resource:v1";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId: rawWorkspaceId } = await context.params;
  const api = await resolvePlanningApiRequest(
    request,
    rawWorkspaceId,
    collectionContractId,
  );
  if (!api.ok) return api.response;

  const page = parsePage(request);
  if (!page) {
    return planningApiErrorResponse(
      collectionContractId,
      400,
      "invalid_pagination",
    );
  }
  const results = await Promise.all([
    loadPlanningWorkspaceVersion(api.supabase, api.workspaceId),
    listPlanningTasks(
      api.supabase,
      api.workspaceId,
      page.offset,
      page.limit,
    ),
  ]).catch(() => null);
  if (!results) {
    return planningApiErrorResponse(
      collectionContractId,
      503,
      "planning_api_unavailable",
    );
  }
  const [workspace, tasks] = results;
  if (!workspace.ok) {
    return planningApiErrorResponse(
      collectionContractId,
      404,
      "workspace_unavailable",
    );
  }
  if (!tasks.ok) {
    return planningApiErrorResponse(
      collectionContractId,
      503,
      "planning_api_unavailable",
    );
  }

  const collection = planningTaskCollectionSchema.parse({
    schemaVersion: 1,
    workspaceId: api.workspaceId,
    tasks: tasks.tasks,
    page: {
      ...page,
      hasMore: tasks.hasMore,
    },
  });
  return Response.json(collection, {
    headers: planningApiResponseHeaders(collectionContractId),
  });
}

export async function POST(
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

  const body = await readPlanningApiJson(request, resourceContractId);
  if (!body.ok) return body.response;
  const createRequest = planningTaskCreateRequestSchema.safeParse(body.data);
  if (!createRequest.success) {
    return planningApiErrorResponse(
      resourceContractId,
      400,
      "invalid_request",
    );
  }

  const workspace = await loadPlanningWorkspaceVersion(
    api.supabase,
    api.workspaceId,
  ).catch(() => null);
  if (!workspace) {
    return planningApiErrorResponse(
      resourceContractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!workspace.ok) {
    return planningApiErrorResponse(
      resourceContractId,
      404,
      "workspace_unavailable",
    );
  }

  const created = await createPlanningTask(
    api.supabase,
    api.workspaceId,
    createRequest.data.task,
  ).catch(() => null);
  if (
    !created
    || (created.ok === false && created.reason === "unavailable")
  ) {
    return planningApiErrorResponse(
      resourceContractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!created.ok) {
    return planningApiErrorResponse(
      resourceContractId,
      409,
      "version_conflict",
    );
  }

  const task = planningTaskResourceSchema.parse(created.task);
  return Response.json(task, {
    status: created.replayed ? 200 : 201,
    headers: planningApiResponseHeaders(resourceContractId),
  });
}

function parsePage(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const rawLimit = searchParams.get("limit") ?? "50";
  const rawOffset = searchParams.get("offset") ?? "0";
  if (!/^\d+$/.test(rawLimit) || !/^\d+$/.test(rawOffset)) return null;
  const limit = Number(rawLimit);
  const offset = Number(rawOffset);
  if (
    !Number.isSafeInteger(limit)
    || limit < 1
    || limit > 100
    || !Number.isSafeInteger(offset)
    || offset < 0
    || offset > 100000
  ) {
    return null;
  }
  return { limit, offset };
}
