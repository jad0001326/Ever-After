export function publicCatalogueHeaders(contractId: string) {
  return {
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    "X-Content-Type-Options": "nosniff",
    "X-EverAft-Contract": contractId,
  };
}

export function privateCatalogueHeaders(contractId: string) {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "Vary": "Authorization",
    "X-Content-Type-Options": "nosniff",
    "X-EverAft-Contract": contractId,
  };
}

export function catalogueError(
  contractId: string,
  status: number,
  error: string,
  privacy: "public" | "private" = "public",
  extraHeaders: Record<string, string> = {},
) {
  return Response.json({ error }, {
    status,
    headers: {
      ...(privacy === "private"
        ? privateCatalogueHeaders(contractId)
        : publicCatalogueHeaders(contractId)),
      ...extraHeaders,
    },
  });
}

export async function resolveCatalogueAuthentication(
  request: Request,
  contractId: string,
) {
  const authentication = await authenticatePlanningApiRequest(request);
  if (authentication.ok) return authentication;
  if (
    authentication.reason === "server_not_configured"
    || authentication.reason === "authentication_unavailable"
  ) {
    return {
      ok: false,
      response: catalogueError(
        contractId,
        503,
        "catalogue_api_unavailable",
        "private",
      ),
    } as const;
  }
  return {
    ok: false,
    response: catalogueError(
      contractId,
      401,
      "authentication_required",
      "private",
      { "WWW-Authenticate": 'Bearer realm="EverAft Catalogue API"' },
    ),
  } as const;
}
import { authenticatePlanningApiRequest } from "@/lib/planning-workspace/api-auth";
