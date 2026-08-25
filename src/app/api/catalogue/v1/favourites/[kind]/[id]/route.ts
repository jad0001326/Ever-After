import {
  catalogueFavouriteKindSchema,
  catalogueFavouriteMutationSchema,
} from "@everaft/planning-contracts/catalogue/venue-api-schema";
import { z } from "zod";
import { catalogueError, privateCatalogueHeaders, resolveCatalogueAuthentication } from "@/lib/catalogue/api-route";
import { setCatalogueFavourite } from "@/lib/catalogue/favourites-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contractId = "urn:everaft:catalogue:favourite-mutation:v1";
const idSchema = z.string().uuid();

export async function PUT(request: Request, context: RouteContext) {
  return mutate(request, context, true);
}

export async function DELETE(request: Request, context: RouteContext) {
  return mutate(request, context, false);
}

type RouteContext = { params: Promise<{ kind: string; id: string }> };

async function mutate(request: Request, context: RouteContext, saved: boolean) {
  const api = await resolveCatalogueAuthentication(request, contractId);
  if (!api.ok) return api.response;
  const raw = await context.params;
  const kind = catalogueFavouriteKindSchema.safeParse(raw.kind);
  const id = idSchema.safeParse(raw.id);
  if (!kind.success || !id.success) {
    return catalogueError(contractId, 400, "invalid_favourite_target", "private");
  }

  const result = await setCatalogueFavourite(
    api.supabase,
    api.user.id,
    kind.data,
    id.data,
    saved,
  ).catch(() => null);
  if (result?.ok === false && result.reason === "target_not_found") {
    return catalogueError(contractId, 404, "favourite_target_not_found", "private");
  }
  if (!result?.ok) return catalogueError(contractId, 503, "catalogue_api_unavailable", "private");

  const payload = catalogueFavouriteMutationSchema.parse({
    schemaVersion: 1,
    kind: kind.data,
    id: id.data,
    saved,
  });
  return Response.json(payload, { headers: privateCatalogueHeaders(contractId) });
}
