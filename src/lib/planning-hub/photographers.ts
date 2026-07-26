import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { normalisePlanningHubSupplierSearchParams } from "./supplier-search";
import { getPlanningHubSupplierDetail, searchPlanningHubSuppliers } from "./suppliers";
import type {
  PlanningHubPhotographer,
  PlanningHubPhotographerDetail,
  PlanningHubPhotographerResults,
  PlanningHubPhotographySearchParams,
  PlanningHubSupplier,
} from "./types";

type PhotographerRow = Database["public"]["Tables"]["photographer_profiles"]["Row"];
type PlanningHubSupabaseClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export async function searchPlanningHubPhotographers(
  params: PlanningHubPhotographySearchParams,
): Promise<PlanningHubPhotographerResults> {
  const filters = normalisePlanningHubSupplierSearchParams(params);
  const supabase = await createClient();
  if (!supabase) return photographerSearchError(filters.page, "Supplier search is unavailable.");

  let styleCandidateIds: string[] | undefined;
  if (params.style?.trim()) {
    const { data, error } = await supabase
      .from("photographer_profiles")
      .select("supplier_id")
      .contains("styles", [params.style.trim().slice(0, 80)]);
    if (error) {
      return photographerSearchError(filters.page, "Photography styles could not be filtered.");
    }
    styleCandidateIds = (data ?? []).map((profile) => profile.supplier_id);
  }

  const result = await searchPlanningHubSuppliers("photographer", params, {
    candidateIds: styleCandidateIds,
    client: supabase,
  });
  if (result.error) return photographerSearchError(result.page, result.error);

  const profiles = await fetchProfileMap(supabase, result.suppliers.map((supplier) => supplier.id));
  return {
    photographers: result.suppliers.map((supplier) => (
      photographerFromSupplier(supplier, profiles.get(supplier.id) ?? null)
    )),
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
  };
}

export async function getPlanningHubPhotographerDetail(
  photographerId: string,
): Promise<PlanningHubPhotographerDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const [supplier, { data: profile }] = await Promise.all([
    getPlanningHubSupplierDetail("photographer", photographerId, supabase),
    supabase
      .from("photographer_profiles")
      .select("*")
      .eq("supplier_id", photographerId)
      .maybeSingle(),
  ]);
  if (!supplier) return null;

  const profileRow = profile as PhotographerRow | null;
  return {
    ...photographerFromSupplier(supplier, profileRow),
    description: supplier.description,
    services: supplier.services,
    officialWebsiteUrl: supplier.officialWebsiteUrl,
    enquiryUrl: supplier.enquiryUrl,
    gallery: supplier.gallery,
    coverageHoursMin: profileRow?.coverage_hours_min ?? null,
    coverageHoursMax: profileRow?.coverage_hours_max ?? null,
    turnaroundWeeksMin: profileRow?.turnaround_weeks_min ?? null,
    turnaroundWeeksMax: profileRow?.turnaround_weeks_max ?? null,
  };
}

function photographerFromSupplier(
  supplier: PlanningHubSupplier,
  profile: PhotographerRow | null,
): PlanningHubPhotographer {
  return {
    id: supplier.id,
    slug: supplier.slug,
    name: supplier.name,
    baseTown: supplier.baseTown,
    region: supplier.region,
    summary: supplier.summary,
    styles: profile?.styles ?? [],
    heroImageUrl: supplier.heroImageUrl,
    hasApprovedPhoto: supplier.hasApprovedPhoto,
    startingPricePence: supplier.startingPricePence,
    typicalPricePence: supplier.typicalPricePence,
    pricingSummary: supplier.pricingSummary,
    pricingUnit: supplier.pricingUnit,
    isClaimed: supplier.isClaimed,
    travelsNationwide: supplier.travelsNationwide,
  };
}

async function fetchProfileMap(
  supabase: PlanningHubSupabaseClient,
  supplierIds: string[],
) {
  const result = new Map<string, PhotographerRow>();
  if (supplierIds.length === 0) return result;
  const { data } = await supabase
    .from("photographer_profiles")
    .select("*")
    .in("supplier_id", supplierIds);
  for (const row of (data ?? []) as PhotographerRow[]) result.set(row.supplier_id, row);
  return result;
}

function photographerSearchError(page: number, message: string): PlanningHubPhotographerResults {
  return { photographers: [], total: 0, page, totalPages: 1, error: message };
}
