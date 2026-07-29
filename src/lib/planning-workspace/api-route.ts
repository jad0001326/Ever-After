import { authenticatePlanningApiRequest } from "./api-auth";
import { planningWorkspaceIdSchema } from "./validation";

export function planningApiResponseHeaders(contractId: string) {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "Vary": "Authorization",
    "X-Content-Type-Options": "nosniff",
    "X-EverAft-Contract": contractId,
  };
}

export function planningApiErrorResponse(
  contractId: string,
  status: number,
  code: string,
  extraHeaders: Record<string, string> = {},
) {
  return Response.json(
    { error: code },
    {
      status,
      headers: {
        ...planningApiResponseHeaders(contractId),
        ...extraHeaders,
      },
    },
  );
}

export async function resolvePlanningApiRequest(
  request: Request,
  rawWorkspaceId: string,
  contractId: string,
) {
  if (process.env.PLANNING_WORKSPACE_CLOUD_ENABLED !== "true") {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        503,
        "connected_planning_disabled",
      ),
    } as const;
  }

  const workspaceId = planningWorkspaceIdSchema.safeParse(rawWorkspaceId);
  if (!workspaceId.success) {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        400,
        "invalid_workspace_id",
      ),
    } as const;
  }

  const authentication = await authenticatePlanningApiRequest(request);
  if (!authentication.ok) {
    if (
      authentication.reason === "server_not_configured"
      || authentication.reason === "authentication_unavailable"
    ) {
      return {
        ok: false,
        response: planningApiErrorResponse(
          contractId,
          503,
          "planning_api_unavailable",
        ),
      } as const;
    }
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        401,
        "authentication_required",
        { "WWW-Authenticate": 'Bearer realm="EverAft Planning API"' },
      ),
    } as const;
  }

  return {
    ok: true,
    workspaceId: workspaceId.data,
    supabase: authentication.supabase,
    user: authentication.user,
  } as const;
}
