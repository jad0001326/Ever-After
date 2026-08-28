import { z } from "zod";
import { catalogueError, publicCatalogueHeaders } from "@/lib/catalogue/api-route";
import { catalogueSupplierDetail } from "@/lib/catalogue/suppliers-api";
import { getPlanningHubPhotographerDetail } from "@/lib/planning-hub/photographers";
import { getLivePlanningHubSupplierCategory } from "@/lib/planning-hub/supplier-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const contractId = "urn:everaft:catalogue:supplier-detail:v1";
const idSchema = z.string().uuid();

export async function GET(request: Request, context: { params: Promise<{ category: string; supplierId: string }> }) {
  const params = await context.params;
  if (!getLivePlanningHubSupplierCategory(params.category) || params.category !== "photographer") return catalogueError(contractId, 404, "supplier_category_not_found");
  const id = idSchema.safeParse(params.supplierId);
  if (!id.success) return catalogueError(contractId, 400, "invalid_supplier_id");
  let detail;
  try {
    detail = await getPlanningHubPhotographerDetail(id.data);
  } catch {
    detail = undefined;
  }
  if (detail === undefined) return catalogueError(contractId, 503, "catalogue_unavailable");
  if (detail === null) return catalogueError(contractId, 404, "supplier_not_found");
  return Response.json(catalogueSupplierDetail(request, detail), { headers: publicCatalogueHeaders(contractId) });
}
