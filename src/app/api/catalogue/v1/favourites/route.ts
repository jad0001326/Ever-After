import { catalogueFavouriteCollectionSchema } from "@everaft/planning-contracts/catalogue/venue-api-schema";
import { catalogueError, privateCatalogueHeaders, resolveCatalogueAuthentication } from "@/lib/catalogue/api-route";
import { listCatalogueFavourites } from "@/lib/catalogue/favourites-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contractId = "urn:everaft:catalogue:favourite-collection:v1";

export async function GET(request: Request) {
  const api = await resolveCatalogueAuthentication(request, contractId);
  if (!api.ok) return api.response;
  const limit = parseLimit(request);
  if (!limit) return catalogueError(contractId, 400, "invalid_pagination", "private");

  const result = await listCatalogueFavourites(api.supabase, api.user.id, limit).catch(() => null);
  if (!result?.ok) return catalogueError(contractId, 503, "catalogue_api_unavailable", "private");

  const payload = catalogueFavouriteCollectionSchema.parse({
    schemaVersion: 1,
    venueIds: result.venueIds,
    supplierIds: result.supplierIds,
    hasMore: result.hasMore,
  });
  return Response.json(payload, { headers: privateCatalogueHeaders(contractId) });
}

function parseLimit(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  if ([...searchParams.keys()].some((key) => key !== "limit")) return null;
  const raw = searchParams.get("limit") ?? "50";
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= 100 ? value : null;
}
