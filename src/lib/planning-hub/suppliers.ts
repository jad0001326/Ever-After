import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SupplierCategorySlug } from "@/types/supplier";
import { safePostgrestSearch } from "./search";
import {
  getLivePlanningHubSupplierCategory,
  normalisePlanningHubSupplierSearchParams,
  PLANNING_HUB_SUPPLIER_PAGE_SIZE,
} from "./supplier-search";
import type {
  PlanningHubSupplier,
  PlanningHubSupplierDetail,
  PlanningHubSupplierResults,
  PlanningHubSupplierSearchParams,
} from "./types";
import { permittedSupplierHero } from "@/lib/supplier-media";

type SupplierRow = Database["public"]["Tables"]["supplier_listings"]["Row"];
type SupplierImageRow = Database["public"]["Tables"]["supplier_images"]["Row"];
type PlanningHubSupabaseClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

const SUPPLIER_CARD_COLUMNS = "id, category_slug, slug, name, base_town, region, summary, starting_price_pence, typical_price_pence, pricing_summary, pricing_unit, hero_image_url, image_permission_status, is_claimed, is_featured, travels_nationwide";

type SupplierCardRow = Pick<
  SupplierRow,
  "id" | "category_slug" | "slug" | "name" | "base_town" | "region" | "summary" |
  "starting_price_pence" | "typical_price_pence" | "pricing_summary" | "pricing_unit" |
  "hero_image_url" | "image_permission_status" | "is_claimed" | "is_featured" | "travels_nationwide"
>;

export async function searchPlanningHubSuppliers(
  categorySlug: SupplierCategorySlug,
  params: PlanningHubSupplierSearchParams,
  options: {
    candidateIds?: string[];
    client?: PlanningHubSupabaseClient;
  } = {},
): Promise<PlanningHubSupplierResults> {
  const filters = normalisePlanningHubSupplierSearchParams(params);
  const category = getLivePlanningHubSupplierCategory(categorySlug);
  if (!category) return supplierSearchError(filters.page, "This supplier category is unavailable.");
  const supabase = options.client ?? await createClient();
  if (!supabase) return supplierSearchError(filters.page, "Supplier search is unavailable.");

  const from = (filters.page - 1) * PLANNING_HUB_SUPPLIER_PAGE_SIZE;
  const to = from + PLANNING_HUB_SUPPLIER_PAGE_SIZE - 1;
  const candidateGroups: string[][] = [];
  if (options.candidateIds) candidateGroups.push(unique(options.candidateIds));

  if (filters.venue) {
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("id, town, region")
      .eq("id", filters.venue)
      .eq("status", "published")
      .in("listing_status", ["published", "claimed"])
      .maybeSingle();
    if (venueError) {
      return supplierSearchError(filters.page, "Venue-based supplier matching is temporarily unavailable.");
    }

    if (!venue) {
      return {
        suppliers: [], total: 0, page: filters.page, totalPages: 1,
        venueContext: "stale",
      };
    } else {
      const baseCoverageQuery = () => supabase
        .from("supplier_listings")
        .select("id")
        .eq("category_slug", categorySlug)
        .eq("listing_status", "published");
      const [nearby, serviceArea, connected] = await Promise.all([
        baseCoverageQuery().or(`travels_nationwide.eq.true,region.ilike.%${safePostgrestSearch(venue.region)}%,base_town.ilike.%${safePostgrestSearch(venue.town)}%`),
        baseCoverageQuery().overlaps("service_areas", [venue.region, venue.town]),
        supabase
          .from("supplier_venue_connections")
          .select("supplier_id")
          .eq("venue_id", venue.id)
          .eq("status", "verified"),
      ]);
      if (nearby.error || serviceArea.error || connected.error) {
        return supplierSearchError(filters.page, "Venue-based supplier matching is temporarily unavailable.");
      }
      candidateGroups.push(unique([
        ...(nearby.data ?? []).map((supplier) => supplier.id),
        ...(serviceArea.data ?? []).map((supplier) => supplier.id),
        ...(connected.data ?? []).map((connection) => connection.supplier_id),
      ]));
    }
  }

  if (filters.location) {
    const safeLocation = safePostgrestSearch(filters.location);
    const baseLocationQuery = () => supabase
      .from("supplier_listings")
      .select("id")
      .eq("category_slug", categorySlug)
      .eq("listing_status", "published");
    const [nearby, serviceArea] = await Promise.all([
      baseLocationQuery().or(`travels_nationwide.eq.true,region.ilike.%${safeLocation}%,base_town.ilike.%${safeLocation}%`),
      baseLocationQuery().overlaps("service_areas", [filters.location]),
    ]);
    if (nearby.error || serviceArea.error) {
      return supplierSearchError(filters.page, "Location-based supplier matching is temporarily unavailable.");
    }
    candidateGroups.push(unique([
      ...(nearby.data ?? []).map((supplier) => supplier.id),
      ...(serviceArea.data ?? []).map((supplier) => supplier.id),
    ]));
  }

  const candidateIds = intersect(candidateGroups);
  if (candidateIds?.length === 0) {
    return { suppliers: [], total: 0, page: filters.page, totalPages: 1 };
  }

  let query = supabase
    .from("supplier_listings")
    .select(SUPPLIER_CARD_COLUMNS, { count: "exact" })
    .eq("category_slug", categorySlug)
    .eq("listing_status", "published");

  if (candidateIds) query = query.in("id", candidateIds);
  if (filters.search) query = query.ilike("name", `%${safePostgrestSearch(filters.search)}%`);
  if (filters.budgetPence !== null) {
    query = query.or(`starting_price_pence.is.null,starting_price_pence.lte.${filters.budgetPence}`);
  }

  if (filters.sort === "price-desc") {
    query = query.order("starting_price_pence", { ascending: false, nullsFirst: false }).order("id", { ascending: true });
  } else if (filters.sort === "name") {
    query = query.order("name", { ascending: true }).order("id", { ascending: true });
  } else if (filters.sort === "newest") {
    query = query.order("updated_at", { ascending: false }).order("id", { ascending: true });
  } else {
    query = query
      .order("is_featured", { ascending: false })
      .order("starting_price_pence", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
      .order("id", { ascending: true });
  }

  const { data, count, error } = await query.range(from, to);
  if (error || !data) {
    return supplierSearchError(
      filters.page,
      `${category.plural} could not be loaded.`,
    );
  }

  const rows = data as SupplierCardRow[];
  const total = count ?? rows.length;
  return {
    suppliers: rows.map(supplierFromRow),
    total,
    page: filters.page,
    totalPages: Math.max(Math.ceil(total / PLANNING_HUB_SUPPLIER_PAGE_SIZE), 1),
    venueContext: filters.venue ? "matched" : "not_provided",
  };
}

export async function getPlanningHubSupplierDetail(
  categorySlug: SupplierCategorySlug,
  supplierId: string,
  client?: PlanningHubSupabaseClient,
): Promise<PlanningHubSupplierDetail | null> {
  if (!getLivePlanningHubSupplierCategory(categorySlug)) return null;
  const supabase = client ?? await createClient();
  if (!supabase) throw new Error("Supplier catalogue is unavailable.");

  const [supplierResult, imageResult] = await Promise.all([
    supabase
      .from("supplier_listings")
      .select(`${SUPPLIER_CARD_COLUMNS}, description, services, official_website_url, enquiry_url, image_credit`)
      .eq("id", supplierId)
      .eq("category_slug", categorySlug)
      .eq("listing_status", "published")
      .maybeSingle(),
    supabase
      .from("supplier_images")
      .select("id, url, alt, sort_order")
      .eq("supplier_id", supplierId)
      .eq("permission_status", "approved")
      .order("sort_order", { ascending: true })
      .limit(12),
  ]);
  if (supplierResult.error || imageResult.error) {
    throw new Error("Supplier catalogue is unavailable.");
  }
  const supplier = supplierResult.data;
  const images = imageResult.data;
  if (!supplier) return null;

  const row = supplier as SupplierRow;
  return {
    ...supplierFromRow(row),
    description: row.description,
    services: row.services,
    officialWebsiteUrl: row.official_website_url,
    enquiryUrl: row.enquiry_url,
    imageCredit: row.image_credit,
    gallery: ((images ?? []) as Pick<SupplierImageRow, "id" | "url" | "alt" | "sort_order">[])
      .map((image) => ({ id: image.id, url: image.url, alt: image.alt })),
  };
}

function supplierFromRow(row: SupplierCardRow): PlanningHubSupplier {
  const heroImageUrl = permittedSupplierHero(row.hero_image_url, row.image_permission_status);
  return {
    id: row.id,
    categorySlug: row.category_slug as SupplierCategorySlug,
    slug: row.slug,
    name: row.name,
    baseTown: row.base_town,
    region: row.region,
    summary: row.summary,
    heroImageUrl: heroImageUrl ?? "/everaft-logo-mark.svg",
    hasApprovedPhoto: Boolean(heroImageUrl),
    visualStatus: heroImageUrl && (row.image_permission_status === "approved" || row.image_permission_status === "representative")
      ? row.image_permission_status
      : null,
    startingPricePence: row.starting_price_pence,
    typicalPricePence: row.typical_price_pence,
    pricingSummary: row.pricing_summary,
    pricingUnit: row.pricing_unit,
    isClaimed: row.is_claimed,
    travelsNationwide: row.travels_nationwide,
  };
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

function supplierSearchError(page: number, message: string): PlanningHubSupplierResults {
  return { suppliers: [], total: 0, page, totalPages: 1, error: message };
}
