import { catalogueError, publicCatalogueHeaders } from "@/lib/catalogue/api-route";
import { catalogueSupplierCollection, parseCatalogueSupplierSearch } from "@/lib/catalogue/suppliers-api";
import { searchPlanningHubPhotographers } from "@/lib/planning-hub/photographers";
import { getLivePlanningHubSupplierCategory } from "@/lib/planning-hub/supplier-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const contractId = "urn:everaft:catalogue:supplier-collection:v1";

export async function GET(request: Request, context: { params: Promise<{ category: string }> }) {
  const category = (await context.params).category;
  if (!getLivePlanningHubSupplierCategory(category) || category !== "photographer") return catalogueError(contractId, 404, "supplier_category_not_found");
  const params = parseCatalogueSupplierSearch(request);
  if (!params) return catalogueError(contractId, 400, "invalid_search");
  const result = await searchPlanningHubPhotographers(params).catch(() => null);
  if (!result || result.error) return catalogueError(contractId, 503, "catalogue_unavailable");
  const payload = catalogueSupplierCollection(request, category, params, result);
  if (!payload) return catalogueError(contractId, 404, "supplier_category_not_found");
  return Response.json(payload, { headers: publicCatalogueHeaders(contractId) });
}
