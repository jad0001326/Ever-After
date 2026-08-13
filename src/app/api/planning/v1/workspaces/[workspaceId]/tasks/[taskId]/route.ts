import {
  planningApiErrorResponse,
  planningApiResponseHeaders,
  readPlanningApiJson,
  resolvePlanningApiRequest,
} from "@/lib/planning-workspace/api-route";
import {
  deletePlanningTask,
  loadPlanningTask,
  updatePlanningTask,
} from "@/lib/planning-workspace/task-api";
import {
  planningTaskDeleteRequestSchema,
  planningTaskDeleteSuccessSchema,
  planningTaskResourceSchema,
  planningTaskUpdateRequestSchema,
} from "@/lib/planning-workspace/task-api-schema";
import { loadPlanningWorkspaceVersion } from "@/lib/planning-workspace/server-snapshot";
import { planningRecordIdSchema } from "@/lib/planning-workspace/validation";
import type { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resourceContractId = "urn:everaft:planning-task-resource:v1";
const deleteContractId = "urn:everaft:planning-task-delete-success:v1";
type RouteContext = {
  params: Promise<{ workspaceId: string; taskId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const resolved = await resolveTaskRequest(
    request,
    context,
    resourceContractId,
    planningTaskUpdateRequestSchema,
  );
  if (!resolved.ok) return resolved.response;
  if (resolved.task.updatedAt !== resolved.body.expectedTaskUpdatedAt) {
    return planningApiErrorResponse(
      resourceContractId,
      409,
      "version_conflict",
    );
  }

  const updated = await updatePlanningTask(
    resolved.supabase,
    resolved.workspaceId,
    resolved.taskId,
    resolved.body.changes,
    resolved.body.expectedTaskUpdatedAt,
  ).catch(() => null);
  if (
    !updated
    || (updated.ok === false && updated.reason === "unavailable")
  ) {
    return planningApiErrorResponse(
      resourceContractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!updated.ok) {
    return planningApiErrorResponse(
      resourceContractId,
      409,
      "version_conflict",
    );
  }

  const task = planningTaskResourceSchema.parse(updated.task);
  return Response.json(task, {
    headers: planningApiResponseHeaders(resourceContractId),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const resolved = await resolveTaskRequest(
    request,
    context,
    deleteContractId,
    planningTaskDeleteRequestSchema,
  );
  if (!resolved.ok) return resolved.response;
  if (resolved.task.updatedAt !== resolved.body.expectedTaskUpdatedAt) {
    return planningApiErrorResponse(
      deleteContractId,
      409,
      "version_conflict",
    );
  }

  const deleted = await deletePlanningTask(
    resolved.supabase,
    resolved.workspaceId,
    resolved.taskId,
    resolved.body.expectedTaskUpdatedAt,
  ).catch(() => null);
  if (
    !deleted
    || (deleted.ok === false && deleted.reason === "unavailable")
  ) {
    return planningApiErrorResponse(
      deleteContractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!deleted.ok) {
    return planningApiErrorResponse(
      deleteContractId,
      409,
      "version_conflict",
    );
  }

  const success = planningTaskDeleteSuccessSchema.parse({
    schemaVersion: 1,
    taskId: deleted.taskId,
    deleted: true,
  });
  return Response.json(success, {
    headers: planningApiResponseHeaders(deleteContractId),
  });
}

async function resolveTaskRequest<TSchema extends z.ZodType>(
  request: Request,
  context: RouteContext,
  contractId: string,
  schema: TSchema,
) {
  const { workspaceId: rawWorkspaceId, taskId: rawTaskId } =
    await context.params;
  const api = await resolvePlanningApiRequest(
    request,
    rawWorkspaceId,
    contractId,
  );
  if (!api.ok) return api;

  const taskId = planningRecordIdSchema.safeParse(rawTaskId);
  if (!taskId.success) {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        400,
        "invalid_task_id",
      ),
    } as const;
  }
  const body = await readPlanningApiJson(request, contractId);
  if (!body.ok) return body;
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        400,
        "invalid_request",
      ),
    } as const;
  }

  const results = await Promise.all([
    loadPlanningWorkspaceVersion(api.supabase, api.workspaceId),
    loadPlanningTask(api.supabase, api.workspaceId, taskId.data),
  ]).catch(() => null);
  if (!results) {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        503,
        "planning_api_unavailable",
      ),
    } as const;
  }
  const [workspace, task] = results;
  if (!workspace.ok) {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        404,
        "workspace_unavailable",
      ),
    } as const;
  }
  if (!task.ok) {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        503,
        "planning_api_unavailable",
      ),
    } as const;
  }
  if (!task.task) {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        404,
        "task_unavailable",
      ),
    } as const;
  }

  return {
    ok: true,
    supabase: api.supabase,
    workspaceId: api.workspaceId,
    taskId: taskId.data,
    task: task.task,
    body: parsed.data as z.output<TSchema>,
  } as const;
}
