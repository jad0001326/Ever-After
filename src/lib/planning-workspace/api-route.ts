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

export async function readPlanningApiJson(
  request: Request,
  contractId: string,
  maxBodyBytes = 1_000_000,
) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        415,
        "unsupported_media_type",
      ),
    } as const;
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        413,
        "payload_too_large",
      ),
    } as const;
  }

  const rawBody = await request.text().catch(() => null);
  if (
    rawBody === null
    || new TextEncoder().encode(rawBody).byteLength > maxBodyBytes
  ) {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        413,
        "payload_too_large",
      ),
    } as const;
  }
  try {
    return { ok: true, data: JSON.parse(rawBody) as unknown } as const;
  } catch {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        400,
        "invalid_request",
      ),
    } as const;
  }
}
