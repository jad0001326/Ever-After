import { createClient } from "@/lib/supabase/server";
import { INTERNAL_TEST_VENUE_SLUG_PREFIX } from "@/lib/internal-test-venue";
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

export async function searchVenueListings(params: VenueSearchParams) {
  const supabase = await createClient();
  const page = Math.max(Number(params.page) || 1, 1);
  const pageSize = 6;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!supabase) {
    return {
      venues: [],
      total: 0,
      page,
      totalPages: 1,
      error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    };
  }

  let query = supabase
    .from("venues")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .in("listing_status", ["published", "claimed"])
    .not("slug", "like", `${INTERNAL_TEST_VENUE_SLUG_PREFIX}%`);

  if (params.location) {
    const value = `%${params.location}%`;
    query = query.or(`region.ilike.${value},town.ilike.${value},country.ilike.${value}`);
  }

  const guests = Number(params.guests);
  if (!Number.isNaN(guests) && guests > 0) query = query.gte("capacity_max", guests);

  const budget = Number(params.budget);
  if (!Number.isNaN(budget) && budget > 0) query = query.not("price_from", "is", null).lte("price_from", budget);

  if (params.type) query = query.eq("type", params.type);

  if (params.sort === "price-desc") query = query.order("price_from", { ascending: false, nullsFirst: false });
  else if (params.sort === "capacity-desc") query = query.order("capacity_max", { ascending: false });
  else query = query.order("price_from", { ascending: true, nullsFirst: false });

  const { data, count, error } = await query.range(from, to);

  if (error || !data) {
    return {
      venues: [],
      total: 0,
      page,
      totalPages: 1,
      error: error?.message ?? "Supabase did not return venue data."
    };
  }

  const visibleRows = data.filter(isVisibleVenueRow);
  const priceOptions = await fetchPublishedPriceOptions(supabase, visibleRows.map((row) => row.id));
  const total = count ?? data.length;
  return {
    venues: visibleRows.map((row) => venueFromRow(row, [], [], priceOptions.get(row.id) ?? [])),
    total,
    page,
    totalPages: Math.max(Math.ceil(total / pageSize), 1)
  };
}

export async function getFeaturedVenueListings() {
  const supabase = await createClient();
  if (!supabase) {
    return {
      venues: [],
      error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    };
  }

  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("status", "published")
    .in("listing_status", ["published", "claimed"])
    .not("slug", "like", `${INTERNAL_TEST_VENUE_SLUG_PREFIX}%`)
    .eq("is_featured", true)
    .order("updated_at", { ascending: false })
    .limit(3);

  const visibleRows = data?.filter(isVisibleVenueRow) ?? [];
  const priceOptions = await fetchPublishedPriceOptions(supabase, visibleRows.map((row) => row.id));
  return {
    venues: visibleRows.map((row) => venueFromRow(row, [], [], priceOptions.get(row.id) ?? [])),
    error: error?.message
  };
}

export async function getVenueListingBySlug(slug: string): Promise<Venue | undefined> {
  const supabase = await createClient();
  if (!supabase) return undefined;

  const { data: venue } = await supabase.from("venues").select("*").eq("slug", slug).eq("status", "published").single();
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
  const { data } = await supabase.from("venues").select("id, slug, name, type, town, region, hero_image").eq("status", "published").in("listing_status", ["published", "claimed"]).not("slug", "like", `${INTERNAL_TEST_VENUE_SLUG_PREFIX}%`).order("is_featured", { ascending: false }).order("name", { ascending: true }).limit(1000);
  const priceOptions = await fetchPublishedPriceOptions(supabase, (data ?? []).map((venue) => venue.id));
  return (data ?? []).map((venue) => ({
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
    summary: row.summary,
    description: row.description,
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
  return !["draft", "archived"].includes(row.listing_status ?? "published");
}
