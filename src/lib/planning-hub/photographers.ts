import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  PlanningHubPhotographer,
  PlanningHubPhotographerDetail,
  PlanningHubPhotographerResults,
  PlanningHubPhotographySearchParams
} from "./types";

type SupplierRow = Database["public"]["Tables"]["supplier_listings"]["Row"];
type PhotographerRow = Database["public"]["Tables"]["photographer_profiles"]["Row"];
type SupplierImageRow = Database["public"]["Tables"]["supplier_images"]["Row"];

const PHOTOGRAPHER_COLUMNS = "id, slug, name, base_town, region, summary, starting_price_pence, typical_price_pence, pricing_summary, pricing_unit, hero_image_url, is_claimed, is_featured, travels_nationwide";
const PLANNING_HUB_PHOTOGRAPHY_PAGE_SIZE = 8;

export async function searchPlanningHubPhotographers(
  params: PlanningHubPhotographySearchParams
): Promise<PlanningHubPhotographerResults> {
  const supabase = await createClient();
  const page = Math.max(Number(params.page) || 1, 1);
  const from = (page - 1) * PLANNING_HUB_PHOTOGRAPHY_PAGE_SIZE;
  const to = from + PLANNING_HUB_PHOTOGRAPHY_PAGE_SIZE - 1;

  if (!supabase) {
    return { photographers: [], total: 0, page, totalPages: 1, error: "Supplier search is unavailable." };
  }

  const candidateGroups: string[][] = [];

  if (params.style) {
    const { data, error } = await supabase
      .from("photographer_profiles")
      .select("supplier_id")
      .contains("styles", [params.style]);
    if (error) return searchError(page, error.message);
    candidateGroups.push((data ?? []).map((profile) => profile.supplier_id));
  }

  if (params.venue) {
    const { data: venue } = await supabase
      .from("venues")
      .select("id, town, region")
      .eq("id", params.venue)
      .eq("status", "published")
      .in("listing_status", ["published", "claimed"])
      .maybeSingle();

    if (venue) {
      const baseCoverageQuery = () => supabase
        .from("supplier_listings")
        .select("id")
        .eq("category_slug", "photographer")
        .eq("listing_status", "published");
      const [nearby, serviceArea, connected] = await Promise.all([
        baseCoverageQuery().or(`travels_nationwide.eq.true,region.ilike.%${safePostgrestValue(venue.region)}%,base_town.ilike.%${safePostgrestValue(venue.town)}%`),
        baseCoverageQuery().overlaps("service_areas", [venue.region, venue.town]),
        supabase.from("supplier_venue_connections").select("supplier_id").eq("venue_id", venue.id).eq("status", "verified")
      ]);
      candidateGroups.push(unique([
        ...(nearby.data ?? []).map((supplier) => supplier.id),
        ...(serviceArea.data ?? []).map((supplier) => supplier.id),
        ...(connected.data ?? []).map((connection) => connection.supplier_id)
      ]));
    }
  }

  if (params.location?.trim()) {
    const location = params.location.trim();
    const safeLocation = safePostgrestValue(location);
    const baseLocationQuery = () => supabase
      .from("supplier_listings")
      .select("id")
      .eq("category_slug", "photographer")
      .eq("listing_status", "published");
    const [nearby, serviceArea] = await Promise.all([
      baseLocationQuery().or(`travels_nationwide.eq.true,region.ilike.%${safeLocation}%,base_town.ilike.%${safeLocation}%`),
      baseLocationQuery().overlaps("service_areas", [location])
    ]);
    candidateGroups.push(unique([
      ...(nearby.data ?? []).map((supplier) => supplier.id),
      ...(serviceArea.data ?? []).map((supplier) => supplier.id)
    ]));
  }

  const candidateIds = intersect(candidateGroups);
  if (candidateIds?.length === 0) return { photographers: [], total: 0, page, totalPages: 1 };

  let query = supabase
    .from("supplier_listings")
    .select(PHOTOGRAPHER_COLUMNS, { count: "exact" })
    .eq("category_slug", "photographer")
    .eq("listing_status", "published");

  if (candidateIds) query = query.in("id", candidateIds);
  if (params.search?.trim()) query = query.ilike("name", `%${safePostgrestValue(params.search)}%`);

  const budget = Number(params.budget);
  if (Number.isFinite(budget) && budget > 0) {
    query = query.or(`starting_price_pence.is.null,starting_price_pence.lte.${Math.round(budget * 100)}`);
  }

  if (params.sort === "price-desc") query = query.order("starting_price_pence", { ascending: false, nullsFirst: false });
  else if (params.sort === "name") query = query.order("name", { ascending: true });
  else if (params.sort === "newest") query = query.order("updated_at", { ascending: false });
  else query = query.order("is_featured", { ascending: false }).order("starting_price_pence", { ascending: true, nullsFirst: false }).order("name", { ascending: true });

  const { data, count, error } = await query.range(from, to);
  if (error || !data) return searchError(page, error?.message ?? "Photographers could not be loaded.");

  const rows = data as Pick<
    SupplierRow,
    "id" | "slug" | "name" | "base_town" | "region" | "summary" | "starting_price_pence" |
    "typical_price_pence" | "pricing_summary" | "pricing_unit" | "hero_image_url" | "is_claimed" |
    "is_featured" | "travels_nationwide"
  >[];
  const profiles = await fetchProfileMap(supabase, rows.map((row) => row.id));
  const total = count ?? rows.length;

  return {
    photographers: rows.map((row) => photographerFromRow(row, profiles.get(row.id) ?? null)),
    total,
    page,
    totalPages: Math.max(Math.ceil(total / PLANNING_HUB_PHOTOGRAPHY_PAGE_SIZE), 1)
  };
}

export async function getPlanningHubPhotographerDetail(
  photographerId: string
): Promise<PlanningHubPhotographerDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const [{ data: supplier }, { data: profile }, { data: images }] = await Promise.all([
    supabase
      .from("supplier_listings")
      .select(`${PHOTOGRAPHER_COLUMNS}, description, services, official_website_url, enquiry_url`)
      .eq("id", photographerId)
      .eq("category_slug", "photographer")
      .eq("listing_status", "published")
      .maybeSingle(),
    supabase.from("photographer_profiles").select("*").eq("supplier_id", photographerId).maybeSingle(),
    supabase
      .from("supplier_images")
      .select("id, url, alt, sort_order")
      .eq("supplier_id", photographerId)
      .eq("permission_status", "approved")
      .order("sort_order", { ascending: true })
      .limit(12)
  ]);
  if (!supplier) return null;

  const row = supplier as SupplierRow;
  const photographer = photographerFromRow(row, profile as PhotographerRow | null);
  const profileRow = profile as PhotographerRow | null;
  return {
    ...photographer,
    description: row.description,
    services: row.services,
    officialWebsiteUrl: row.official_website_url,
    enquiryUrl: row.enquiry_url,
    gallery: ((images ?? []) as Pick<SupplierImageRow, "id" | "url" | "alt" | "sort_order">[])
      .map((image) => ({ id: image.id, url: image.url, alt: image.alt })),
    coverageHoursMin: profileRow?.coverage_hours_min ?? null,
    coverageHoursMax: profileRow?.coverage_hours_max ?? null,
    turnaroundWeeksMin: profileRow?.turnaround_weeks_min ?? null,
    turnaroundWeeksMax: profileRow?.turnaround_weeks_max ?? null
  };
}

function photographerFromRow(
  row: Pick<
    SupplierRow,
    "id" | "slug" | "name" | "base_town" | "region" | "summary" | "starting_price_pence" |
    "typical_price_pence" | "pricing_summary" | "pricing_unit" | "hero_image_url" | "is_claimed" |
    "travels_nationwide"
  >,
  profile: PhotographerRow | null
): PlanningHubPhotographer {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    baseTown: row.base_town,
    region: row.region,
    summary: row.summary,
    styles: profile?.styles ?? [],
    heroImageUrl: row.hero_image_url ?? "/everaft-logo-mark.svg",
    hasApprovedPhoto: Boolean(row.hero_image_url),
    startingPricePence: row.starting_price_pence,
    typicalPricePence: row.typical_price_pence,
    pricingSummary: row.pricing_summary,
    pricingUnit: row.pricing_unit,
    isClaimed: row.is_claimed,
    travelsNationwide: row.travels_nationwide
  };
}

async function fetchProfileMap(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  supplierIds: string[]
) {
  const result = new Map<string, PhotographerRow>();
  if (supplierIds.length === 0) return result;
  const { data } = await supabase.from("photographer_profiles").select("*").in("supplier_id", supplierIds);
  for (const row of (data ?? []) as PhotographerRow[]) result.set(row.supplier_id, row);
  return result;
}

function intersect(groups: string[][]) {
  if (groups.length === 0) return null;
  let result = new Set(groups[0]);
  for (const group of groups.slice(1)) {
    const candidates = new Set(group);
    result = new Set([...result].filter((id) => candidates.has(id)));
  }
  return [...result];
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function safePostgrestValue(value: string) {
  return value.replace(/[%_,().\\]/g, " ").trim();
}

function searchError(page: number, message: string): PlanningHubPhotographerResults {
  return { photographers: [], total: 0, page, totalPages: 1, error: message };
}
