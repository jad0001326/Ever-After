import { createClient } from "@/lib/supabase/server";
import { catalogueTotalPages, isUnsatisfiableRangeError, normaliseCataloguePage, PUBLIC_CATALOGUE_ERROR, totalFromRangeError } from "@/lib/catalogue-paging";
import { isInternalTestVenueRecord, withoutInternalTestVenues } from "@/lib/internal-test-venue";
import { publicVenueCopy } from "@/lib/public-venue-copy";
import { imageUrlOrRepresentative } from "@/lib/venue-images";
import { normaliseVenuePricingUnit, selectBudgetPriceOption, venuePriceOptionToImportedType } from "@/lib/venue-pricing";
import type { Database } from "@/types/database";
import type { Amenity, Venue, VenuePriceOption, VenueSearchParams } from "@/types/venue";
import type { PlannerListing } from "@/lib/budget/types";

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type VenueImageRow = Database["public"]["Tables"]["venue_images"]["Row"];
type VenuePriceOptionRow = Database["public"]["Tables"]["venue_price_options"]["Row"];
type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;
const PRICE_OPTION_COLUMNS = "id, venue_id, kind, label, amount_from_pence, amount_to_pence, currency, pricing_unit, price_qualifier, included_guests, season_label, day_label, description, tax_label, minimum_nights, valid_from, valid_to, source_url, verified_at, display_priority";
const VENUE_PAGE_SIZE = 6;

type VenueSearchResult = {
  venues: Venue[];
  total: number;
  page: number;
  totalPages: number;
  outOfRange: boolean;
  error?: string;
};

export async function searchVenueListings(params: VenueSearchParams): Promise<VenueSearchResult> {
  const supabase = await createClient();
  const requestedPage = normaliseCataloguePage(params.page);
  const pageSize = VENUE_PAGE_SIZE;

  if (!supabase) {
    console.error("Venue search failed because Supabase is not configured.");
    return emptyVenueSearch(PUBLIC_CATALOGUE_ERROR);
  }

  const from = (requestedPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await venueSearchQuery(supabase, params).range(from, to);

  if (isUnsatisfiableRangeError(error)) {
    return recoverOutOfRangeVenuePage(supabase, params, pageSize, count, error);
  }

  if (error || !data) {
    console.error("Venue search failed", error);
    return emptyVenueSearch(PUBLIC_CATALOGUE_ERROR);
  }

  const total = count ?? data.length;
  return {
    venues: await mapPublicVenueRows(supabase, data),
    total,
    page: requestedPage,
    totalPages: catalogueTotalPages(total, pageSize),
    outOfRange: false
  };
}

export async function getFeaturedVenueListings() {
  const supabase = await createClient();
  if (!supabase) {
    console.error("Featured venue search failed because Supabase is not configured.");
    return {
      venues: [],
      error: PUBLIC_CATALOGUE_ERROR
    };
  }

  const { data, error } = await withoutInternalTestVenues(
    supabase
      .from("venues")
      .select("*")
      .eq("status", "published")
      .in("listing_status", ["published", "claimed"])
  )
    .eq("is_featured", true)
    .order("updated_at", { ascending: false })
    .limit(3);

  if (error) console.error("Featured venue search failed", error);
  return {
    venues: await mapPublicVenueRows(supabase, data ?? []),
    error: error ? PUBLIC_CATALOGUE_ERROR : undefined
  };
}

export async function getVenueListingBySlug(slug: string): Promise<Venue | undefined> {
  const supabase = await createClient();
  if (!supabase) return undefined;

  const { data: venue } = await withoutInternalTestVenues(
    supabase.from("venues").select("*").eq("slug", slug).eq("status", "published")
  ).single();
  if (!venue || !isVisibleVenueRow(venue)) return undefined;

  const [{ data: images }, { data: links }, { data: amenityRows }, priceOptions] = await Promise.all([
    supabase.from("venue_images").select("*").eq("venue_id", venue.id).order("sort_order", { ascending: true }),
    supabase.from("venue_amenities").select("*").eq("venue_id", venue.id),
    supabase.from("amenities").select("*"),
    fetchPublishedPriceOptions(supabase, [venue.id])
  ]);

  const amenityIds = new Set((links ?? []).map((link) => link.amenity_id));
  const mappedAmenities = (amenityRows ?? [])
    .filter((amenity) => amenityIds.has(amenity.id))
    .map((amenity) => ({ id: amenity.slug, name: amenity.name }));

  return venueFromRow(venue, images ?? [], mappedAmenities, priceOptions.get(venue.id) ?? []);
}

export async function getBudgetPlannerVenueListings(): Promise<PlannerListing[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await withoutInternalTestVenues(
    supabase.from("venues").select("id, slug, name, type, town, region, hero_image").eq("status", "published").in("listing_status", ["published", "claimed"])
  ).order("is_featured", { ascending: false }).order("name", { ascending: true }).limit(1000);
  const visibleVenues = (data ?? []).filter((venue) => !isInternalTestVenueRecord(venue));
  const priceOptions = await fetchPublishedPriceOptions(supabase, visibleVenues.map((venue) => venue.id));
  return visibleVenues.map((venue) => ({
    ...plannerListingFromRow(venue, priceOptions.get(venue.id) ?? [])
  }));
}

function venueFromRow(row: VenueRow, images: VenueImageRow[] = [], amenities: Amenity[] = [], priceOptions: VenuePriceOption[] = []): Venue {
  const heroImage = imageUrlOrRepresentative(row.hero_image, row.type);
  const gallery = images.length
    ? images.map((image) => ({ id: image.id, venueId: image.venue_id, url: image.url, alt: image.alt, sortOrder: image.sort_order }))
    : [{ id: `${row.id}-hero`, venueId: row.id, url: heroImage, alt: row.name, sortOrder: 0 }];

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type as Venue["type"],
    region: row.region,
    town: row.town,
    country: "Scotland",
    summary: publicVenueCopy(row.summary),
    description: publicVenueCopy(row.description) || publicVenueCopy(row.summary),
    priceFrom: row.price_from,
    priceTo: row.price_to,
    priceOptions,
    capacityMin: row.capacity_min,
    capacityMax: row.capacity_max,
    heroImage,
    officialWebsiteUrl: row.official_website_url ?? undefined,
    officialGalleryUrl: row.official_gallery_url ?? undefined,
    vendorContactEmail: row.vendor_contact_email ?? undefined,
    listingStatus: row.listing_status ?? "published",
    claimStatus: row.claim_status ?? "unclaimed",
    imagePermissionStatus: row.image_permission_status ?? "representative",
    imageCredit: row.image_credit ?? undefined,
    imageIsRepresentative: row.image_is_representative ?? true,
    isClaimed: row.is_claimed ?? false,
    claimedBy: row.claimed_by ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
    inviteSentAt: row.invite_sent_at ?? undefined,
    inviteStatus: row.invite_status ?? "not_sent",
    images: gallery,
    amenities,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    isFeatured: row.is_featured
  };
}

function plannerListingFromRow(
  venue: Pick<VenueRow, "id" | "slug" | "name" | "type" | "town" | "region" | "hero_image">,
  options: VenuePriceOption[]
): PlannerListing {
  const option = selectBudgetPriceOption(options);
  const priceFromPence = option?.amountFromPence ?? null;
  const priceToPence = option?.amountToPence ?? null;
  const pricingUnit = option ? normaliseVenuePricingUnit(option.pricingUnit, option.kind) : priceFromPence == null ? null : "total";
  const hasRange = priceFromPence != null && priceToPence != null && priceToPence > priceFromPence;

  return {
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    categoryId: "venue",
    location: `${venue.town}, ${venue.region}`,
    imageUrl: imageUrlOrRepresentative(venue.hero_image, venue.type),
    listingUrl: `/venues/${venue.slug}`,
    priceFromPence,
    priceToPence,
    pricingStatus: option ? venuePriceOptionToImportedType(option, hasRange) : priceFromPence == null ? "unavailable" : hasRange ? "range" : "starting_from",
    pricingKind: option?.kind ?? null,
    pricingLabel: option?.label ?? (priceFromPence == null ? null : "Indicative venue price"),
    pricingUnit,
    priceQualifier: option?.priceQualifier ?? null,
    includedGuests: option?.includedGuests ?? null,
    pricingDescription: option?.description ?? null,
    taxLabel: option?.taxLabel ?? null,
    minimumNights: option?.minimumNights ?? null,
    validFrom: option?.validFrom ?? null,
    validTo: option?.validTo ?? null,
    verifiedAt: option?.verifiedAt ?? null
  };
}

async function fetchPublishedPriceOptions(supabase: SupabaseServerClient, venueIds: string[]) {
  const grouped = new Map<string, VenuePriceOption[]>();
  if (venueIds.length === 0) return grouped;
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("venue_price_options")
    .select(PRICE_OPTION_COLUMNS)
    .in("venue_id", venueIds)
    .eq("status", "published")
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order("display_priority", { ascending: true });

  for (const row of (data ?? []) as VenuePriceOptionRow[]) {
    const mapped: VenuePriceOption = {
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
    grouped.set(row.venue_id, [...(grouped.get(row.venue_id) ?? []), mapped]);
  }
  return grouped;
}

function isVisibleVenueRow(row: VenueRow) {
  return !["draft", "archived"].includes(row.listing_status ?? "published") && !isInternalTestVenueRecord(row);
}

function emptyVenueSearch(error?: string) {
  return { venues: [], total: 0, page: 1, totalPages: 1, error, outOfRange: false };
}

type VenueSearchFilter = {
  eq(column: string, value: string): VenueSearchFilter;
  gte(column: string, value: number): VenueSearchFilter;
  lte(column: string, value: number): VenueSearchFilter;
  not(column: string, operator: string, value: null): VenueSearchFilter;
  or(filters: string): VenueSearchFilter;
};

function applyVenueSearchFilters<T>(query: T, params: VenueSearchParams): T {
  let filtered = query as unknown as VenueSearchFilter;

  if (params.location) {
    const value = `%${params.location}%`;
    filtered = filtered.or(`region.ilike.${value},town.ilike.${value},country.ilike.${value}`);
  }

  const guests = Number(params.guests);
  if (!Number.isNaN(guests) && guests > 0) filtered = filtered.gte("capacity_max", guests);

  const budget = Number(params.budget);
  if (!Number.isNaN(budget) && budget > 0) filtered = filtered.not("price_from", "is", null).lte("price_from", budget);

  if (params.type) filtered = filtered.eq("type", params.type);
  return filtered as unknown as T;
}

function venueSearchQuery(supabase: SupabaseServerClient, params: VenueSearchParams) {
  let query = applyVenueSearchFilters(
    withoutInternalTestVenues(
      supabase
        .from("venues")
        .select("*", { count: "exact" })
        .eq("status", "published")
        .in("listing_status", ["published", "claimed"])
    ),
    params
  );

  // Featured listings always lead the matching results, then use the visitor's chosen sort.
  query = query.order("is_featured", { ascending: false });

  if (params.sort === "price-desc") query = query.order("price_from", { ascending: false, nullsFirst: false });
  else if (params.sort === "capacity-desc") query = query.order("capacity_max", { ascending: false });
  else query = query.order("price_from", { ascending: true, nullsFirst: false });

  return query;
}

async function mapPublicVenueRows(supabase: SupabaseServerClient, rows: VenueRow[]) {
  const visibleRows = rows.filter(isVisibleVenueRow);
  const priceOptions = await fetchPublishedPriceOptions(supabase, visibleRows.map((row) => row.id));
  return visibleRows.map((row) => venueFromRow(row, [], [], priceOptions.get(row.id) ?? []));
}

async function recoverOutOfRangeVenuePage(
  supabase: SupabaseServerClient,
  params: VenueSearchParams,
  pageSize: number,
  reportedCount: number | null,
  error: { details?: string | null } | null
): Promise<VenueSearchResult> {
  const knownTotal = typeof reportedCount === "number" ? reportedCount : totalFromRangeError(error);
  let total = knownTotal;
  if (total == null) {
    const counted = await applyVenueSearchFilters(
      withoutInternalTestVenues(
        supabase
          .from("venues")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .in("listing_status", ["published", "claimed"])
      ),
      params
    );
    if (counted.error) {
      console.error("Venue search count failed", counted.error);
      return emptyVenueSearch(PUBLIC_CATALOGUE_ERROR);
    }
    total = counted.count ?? 0;
  }

  const totalPages = catalogueTotalPages(total, pageSize);
  if (total === 0) return { venues: [], total: 0, page: 1, totalPages: 1, outOfRange: true };

  const lastFrom = (totalPages - 1) * pageSize;
  const last = await venueSearchQuery(supabase, params).range(lastFrom, lastFrom + pageSize - 1);
  if (last.error || !last.data) {
    console.error("Venue search could not load the last page", last.error);
    return { venues: [], total, page: totalPages, totalPages, outOfRange: true };
  }

  return {
    venues: await mapPublicVenueRows(supabase, last.data),
    total,
    page: totalPages,
    totalPages,
    outOfRange: true
  };
}
