import { searchPlanningHubVenues } from "@/lib/planning-hub/venues";
import { catalogueError, publicCatalogueHeaders } from "@/lib/catalogue/api-route";
import { catalogueVenueCollection, parseCatalogueVenueSearch } from "@/lib/catalogue/venues-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contractId = "urn:everaft:catalogue:venue-collection:v1";

export async function GET(request: Request) {
  const params = parseCatalogueVenueSearch(request);
  if (!params) return catalogueError(contractId, 400, "invalid_search");

  const result = await searchPlanningHubVenues(params).catch(() => null);
  if (!result || result.error) {
    return catalogueError(contractId, 503, "catalogue_unavailable");
  }

  return Response.json(catalogueVenueCollection(request, result), {
    headers: publicCatalogueHeaders(contractId),
  });
}
