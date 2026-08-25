import { z } from "zod";
import { catalogueError, publicCatalogueHeaders } from "@/lib/catalogue/api-route";
import { catalogueVenueDetail } from "@/lib/catalogue/venues-api";
import { getPlanningHubVenueDetail } from "@/lib/planning-hub/venues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contractId = "urn:everaft:catalogue:venue-detail:v1";
const venueIdSchema = z.string().uuid();

export async function GET(
  request: Request,
  context: { params: Promise<{ venueId: string }> },
) {
  const parsed = venueIdSchema.safeParse((await context.params).venueId);
  if (!parsed.success) return catalogueError(contractId, 400, "invalid_venue_id");

  const detail = await getPlanningHubVenueDetail(parsed.data).catch(() => undefined);
  if (detail === undefined) return catalogueError(contractId, 503, "catalogue_unavailable");
  if (detail === null) return catalogueError(contractId, 404, "venue_not_found");

  return Response.json(catalogueVenueDetail(request, detail), {
    headers: publicCatalogueHeaders(contractId),
  });
}
