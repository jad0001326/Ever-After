import { createClient } from "@/lib/supabase/server";
import { INTERNAL_TEST_VENUE_SLUG_PREFIX } from "@/lib/internal-test-venue";
import { imageUrlOrRepresentative } from "@/lib/venue-images";
import { hasUnresolvedTaxLabel, selectBudgetPriceOption } from "@/lib/venue-pricing";
import type { Database } from "@/types/database";
import type { VenuePriceOption } from "@/types/venue";
import { normalisePlanningHubSearchParams, PLANNING_HUB_PAGE_SIZE, safePostgrestSearch } from "./search";
import type { PlanningHubSearchParams, PlanningHubVenue, PlanningHubVenueDetail, PlanningHubVenueResults } from "./types";

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type PriceRow = Pick<
  Database["public"]["Tables"]["venue_price_options"]["Row"],
  | "id"
  | "venue_id"
  | "kind"
  | "label"
  | "amount_from_pence"
  | "amount_to_pence"
  | "currency"
  | "pricing_unit"
  | "price_qualifier"
  | "included_guests"
  | "season_label"
  | "day_label"
  | "description"
  | "tax_label"
  | "minimum_nights"
  | "valid_from"
  | "valid_to"
  | "source_url"
  | "verified_at"
  | "display_priority"
>;
type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

const VENUE_RESULT_COLUMNS = "id, slug, name, type, town, region, summary, capacity_max, hero_image, image_permission_status, image_is_representative";
const VENUE_DETAIL_COLUMNS = `${VENUE_RESULT_COLUMNS}, description, capacity_min, official_website_url, image_credit`;
const PRICE_COLUMNS = "id, venue_id, kind, label, amount_from_pence, amount_to_pence, currency, pricing_unit, price_qualifier, included_guests, season_label, day_label, description, tax_label, minimum_nights, valid_from, valid_to, source_url, verified_at, display_priority";
const PLANNING_HUB_FALLBACK = "/images/everaft-wedding-reception.png";

export async function searchPlanningHubVenues(params: PlanningHubSearchParams): Promise<PlanningHubVenueResults> {
  const filters = normalisePlanningHubSearchParams(params);
  const supabase = await createClient();
  if (!supabase) {
    return { venues: [], total: 0, page: filters.page, totalPages: 1, error: "Venue search is temporarily unavailable." };
  }

  let eligibleVenueIds: string[] | null = null;
  if (filters.budgetPence != null) {
    eligibleVenueIds = await getBudgetEligibleVenueIds(supabase, filters.budgetPence, filters.guests);
    if (eligibleVenueIds.length === 0) return { venues: [], total: 0, page: 1, totalPages: 1 };
  }

  const from = (filters.page - 1) * PLANNING_HUB_PAGE_SIZE;
  const to = from + PLANNING_HUB_PAGE_SIZE - 1;
  let query = supabase
    .from("venues")
    .select(VENUE_RESULT_COLUMNS, { count: "exact" })
    .eq("status", "published")
    .in("listing_status", ["published", "claimed"])
    .not("slug", "like", `${INTERNAL_TEST_VENUE_SLUG_PREFIX}%`);

  if (filters.search) {
    const value = `%${safePostgrestSearch(filters.search)}%`;
    query = query.or(`name.ilike.${value},town.ilike.${value},region.ilike.${value},type.ilike.${value}`);
  }
  if (filters.location) {
    const value = `%${safePostgrestSearch(filters.location)}%`;
    query = query.or(`town.ilike.${value},region.ilike.${value}`);
  }
  if (filters.guests != null) query = query.gte("capacity_max", filters.guests);
  if (filters.type) query = query.eq("type", filters.type);
  if (eligibleVenueIds) query = query.in("id", eligibleVenueIds);

  const { data, count, error } = await query
    .order("is_featured", { ascending: false })
    .order("name", { ascending: true })
    .range(from, to);

  if (error || !data) {
    return {
      venues: [],
      total: 0,
      page: filters.page,
      totalPages: 1,
      error: error?.message ?? "Venue search could not be loaded."
    };
  }

  const priceOptions = await fetchPublishedPriceOptions(supabase, data.map((venue) => venue.id));
  const total = count ?? data.length;
  return {
    venues: data.map((venue) => planningHubVenueFromRow(venue as VenueRow, priceOptions.get(venue.id) ?? [])),
    total,
    page: filters.page,
    totalPages: Math.max(Math.ceil(total / PLANNING_HUB_PAGE_SIZE), 1)
  };
}

export async function getPlanningHubVenueDetail(venueId: string): Promise<PlanningHubVenueDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: venue } = await supabase
    .from("venues")
    .select(VENUE_DETAIL_COLUMNS)
    .eq("id", venueId)
    .eq("status", "published")
    .in("listing_status", ["published", "claimed"])
    .maybeSingle();
  if (!venue) return null;

  const hasApprovedPhoto = venue.image_permission_status === "approved" && !venue.image_is_representative;
  const [priceOptions, imagesResult, linksResult] = await Promise.all([
    fetchPublishedPriceOptions(supabase, [venue.id]),
    hasApprovedPhoto
      ? supabase.from("venue_images").select("id, url, alt").eq("venue_id", venue.id).order("sort_order", { ascending: true }).limit(12)
      : Promise.resolve({ data: [] }),
    supabase.from("venue_amenities").select("amenity_id").eq("venue_id", venue.id)
  ]);

  const amenityIds = (linksResult.data ?? []).map((link) => link.amenity_id);
  const { data: amenities } = amenityIds.length
    ? await supabase.from("amenities").select("id, name").in("id", amenityIds).order("name", { ascending: true })
    : { data: [] };
  const result = planningHubVenueFromRow(venue as VenueRow, priceOptions.get(venue.id) ?? []);
  const approvedImages = imagesResult.data ?? [];

  return {
    ...result,
    description: venue.description,
    capacityMin: venue.capacity_min,
    officialWebsiteUrl: venue.official_website_url,
    imageCredit: venue.image_credit,
    gallery: approvedImages.length
      ? approvedImages.map((image) => ({ id: image.id, url: image.url, alt: image.alt }))
      : [{ id: `${venue.id}-profile`, url: PLANNING_HUB_FALLBACK, alt: `${venue.name} illustrated venue profile` }],
    amenities: (amenities ?? []).map((amenity) => amenity.name)
  };
}

async function getBudgetEligibleVenueIds(
  supabase: SupabaseServerClient,
  budgetPence: number,
  guests: number | null
) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("venue_price_options")
    .select(PRICE_COLUMNS)
    .eq("status", "published")
    .not("amount_from_pence", "is", null)
    .lte("amount_from_pence", budgetPence)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order("display_priority", { ascending: true });
  const pricesByVenue = groupPrices((data ?? []) as PriceRow[]);

  return [...pricesByVenue.entries()].flatMap(([venueId, options]) => {
    const option = selectBudgetPriceOption(options);
    if (!option || option.amountFromPence == null || hasUnresolvedTaxLabel(option.taxLabel)) return [];
    const cost = option.pricingUnit === "per_person"
      ? guests && guests > 0 ? option.amountFromPence * guests : null
      : ["total", "per_event"].includes(option.pricingUnit) ? option.amountFromPence : null;
    return cost != null && cost <= budgetPence ? [venueId] : [];
  });
}

async function fetchPublishedPriceOptions(supabase: SupabaseServerClient, venueIds: string[]) {
  if (venueIds.length === 0) return new Map<string, VenuePriceOption[]>();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("venue_price_options")
    .select(PRICE_COLUMNS)
    .in("venue_id", venueIds)
    .eq("status", "published")
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order("display_priority", { ascending: true });
  return groupPrices((data ?? []) as PriceRow[]);
}

function planningHubVenueFromRow(row: VenueRow, options: VenuePriceOption[]): PlanningHubVenue {
  const price = selectBudgetPriceOption(options);
  const hasApprovedPhoto = row.image_permission_status === "approved" && !row.image_is_representative;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    town: row.town,
    region: row.region,
    summary: row.summary,
    capacityMax: row.capacity_max,
    imageUrl: hasApprovedPhoto ? imageUrlOrRepresentative(row.hero_image, row.type) : PLANNING_HUB_FALLBACK,
    priceFromPence: price?.amountFromPence ?? null,
    pricingLabel: price?.label ?? null,
    pricingUnit: price?.pricingUnit ?? null,
    hasApprovedPhoto
  };
}

function groupPrices(rows: PriceRow[]) {
  const grouped = new Map<string, VenuePriceOption[]>();
  for (const row of rows) {
    const option: VenuePriceOption = {
      id: row.id,
      venueId: row.venue_id,
      kind: row.kind,
      label: row.label,
      amountFromPence: row.amount_from_pence,
      amountToPence: row.amount_to_pence,
      currency: row.currency ?? "GBP",
      pricingUnit: row.pricing_unit,
      priceQualifier: row.price_qualifier,
      includedGuests: row.included_guests,
      seasonLabel: row.season_label,
      dayLabel: row.day_label,
      description: row.description,
      taxLabel: row.tax_label,
      minimumNights: row.minimum_nights,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      sourceUrl: row.source_url,
      verifiedAt: row.verified_at,
      displayPriority: row.display_priority ?? 100
    };
    grouped.set(row.venue_id, [...(grouped.get(row.venue_id) ?? []), option]);
  }
  return grouped;
}
