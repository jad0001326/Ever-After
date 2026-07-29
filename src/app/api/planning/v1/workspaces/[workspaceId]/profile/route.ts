import {
  planningApiErrorResponse,
  planningApiResponseHeaders,
  readPlanningApiJson,
  resolvePlanningApiRequest,
} from "@/lib/planning-workspace/api-route";
import {
  loadPlanningProfile,
  savePlanningProfile,
} from "@/lib/planning-workspace/profile-api";
import type { WeddingProfile } from "@/lib/planning-workspace/profile";
import {
  planningProfileResourceSchema,
  planningProfileUpdateRequestSchema,
} from "@/lib/planning-workspace/profile-api-schema";
import { loadPlanningWorkspaceVersion } from "@/lib/planning-workspace/server-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contractId = "urn:everaft:planning-profile-resource:v1";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const resolved = await resolveProfileRequest(request, context);
  if (!resolved.ok) return resolved.response;
  return profileResponse(resolved.workspaceId, resolved.profile);
}

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

  const body = await readPlanningApiJson(request, contractId);
  if (!body.ok) return body.response;
  const updateRequest = planningProfileUpdateRequestSchema.safeParse(body.data);
  if (!updateRequest.success) {
    return planningApiErrorResponse(contractId, 400, "invalid_request");
  }

  const loaded = await loadProfileResource(api.supabase, api.workspaceId);
  if (!loaded.ok) return loaded.response;

  const { expectedProfileUpdatedAt, profile } = updateRequest.data;
  if ((loaded.profile?.updatedAt ?? null) !== expectedProfileUpdatedAt) {
    return planningApiErrorResponse(contractId, 409, "version_conflict");
  }

  const saved = await savePlanningProfile(
    api.supabase,
    api.workspaceId,
    profile,
    expectedProfileUpdatedAt,
  ).catch(() => null);
  if (!saved || (saved.ok === false && saved.reason === "unavailable")) {
    return planningApiErrorResponse(
      contractId,
      503,
      "planning_api_unavailable",
    );
  }
  if (!saved.ok) {
    return planningApiErrorResponse(contractId, 409, "version_conflict");
  }
  return profileResponse(api.workspaceId, saved.profile);
}

async function resolveProfileRequest(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId: rawWorkspaceId } = await context.params;
  const api = await resolvePlanningApiRequest(
    request,
    rawWorkspaceId,
    contractId,
  );
  if (!api.ok) return api;
  const loaded = await loadProfileResource(api.supabase, api.workspaceId);
  return loaded.ok
    ? {
      ok: true,
      workspaceId: api.workspaceId,
      profile: loaded.profile,
    } as const
    : loaded;
}

async function loadProfileResource(
  supabase: Parameters<typeof loadPlanningProfile>[0],
  workspaceId: string,
) {
  const results = await Promise.all([
    loadPlanningWorkspaceVersion(supabase, workspaceId),
    loadPlanningProfile(supabase, workspaceId),
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
  const [workspace, profile] = results;
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
  if (!profile.ok) {
    return {
      ok: false,
      response: planningApiErrorResponse(
        contractId,
        503,
        "planning_api_unavailable",
      ),
    } as const;
  }
  return { ok: true, profile: profile.profile } as const;
}

function profileResponse(
  workspaceId: string,
  profile: WeddingProfile | null,
) {
  const resource = planningProfileResourceSchema.parse({
    schemaVersion: 1,
    workspaceId,
    profile,
  });
  return Response.json(resource, {
    headers: planningApiResponseHeaders(contractId),
  });
}
