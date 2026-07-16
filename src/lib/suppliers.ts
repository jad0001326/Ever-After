import { createClient } from "@/lib/supabase/server";
import type { PlannerListing } from "@/lib/budget/types";
import type { Database } from "@/types/database";
import type { PhotographerProfile, PhotographerSearchParams, PhotographerVenueOption, SupplierListing } from "@/types/supplier";

type SupplierRow = Database["public"]["Tables"]["supplier_listings"]["Row"];
type PhotographerRow = Database["public"]["Tables"]["photographer_profiles"]["Row"];
type SupplierImageRow = Database["public"]["Tables"]["supplier_images"]["Row"];

const LISTING_COLUMNS = "id, category_slug, slug, name, base_town, region, country, service_areas, travel_radius_miles, travels_nationwide, summary, description, services, official_website_url, instagram_url, facebook_url, enquiry_url, starting_price_pence, typical_price_pence, pricing_summary, pricing_unit, hero_image_url, image_credit, is_claimed, is_featured, updated_at";

export async function searchPhotographerListings(params: PhotographerSearchParams) {
  const supabase = await createClient();
  const page = Math.max(Number(params.page) || 1, 1);
  const pageSize = 12;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!supabase) return { suppliers: [], total: 0, page, totalPages: 1, error: "Supabase is not configured." };

  let styleSupplierIds: string[] | null = null;
  if (params.style) {
    const { data: profiles, error: styleError } = await supabase
      .from("photographer_profiles")
      .select("supplier_id")
      .contains("styles", [params.style]);
    if (styleError) return { suppliers: [], total: 0, page, totalPages: 1, error: styleError.message };
    styleSupplierIds = (profiles ?? []).map((profile) => profile.supplier_id);
    if (styleSupplierIds.length === 0) return { suppliers: [], total: 0, page, totalPages: 1 };
  }

  let venueSupplierIds: string[] | null = null;
  if (params.venue) {
    const { data: venue } = await supabase
      .from("venues")
      .select("id, town, region")
      .eq("id", params.venue)
      .eq("status", "published")
      .in("listing_status", ["published", "claimed"])
      .maybeSingle();
    if (venue) {
      const baseCoverageQuery = () => supabase.from("supplier_listings").select("id").eq("category_slug", "photographer").eq("listing_status", "published");
      const [nearby, serviceArea, connected] = await Promise.all([
        baseCoverageQuery().or(`travels_nationwide.eq.true,region.ilike.%${safePostgrestValue(venue.region)}%,base_town.ilike.%${safePostgrestValue(venue.town)}%`),
        baseCoverageQuery().overlaps("service_areas", [venue.region, venue.town]),
        supabase.from("supplier_venue_connections").select("supplier_id").eq("venue_id", venue.id).eq("status", "verified")
      ]);
      venueSupplierIds = [...new Set([
        ...(nearby.data ?? []).map((supplier) => supplier.id),
        ...(serviceArea.data ?? []).map((supplier) => supplier.id),
        ...(connected.data ?? []).map((connection) => connection.supplier_id)
      ])];
      if (venueSupplierIds.length === 0) return { suppliers: [], total: 0, page, totalPages: 1 };
    }
  }

  let locationSupplierIds: string[] | null = null;
  if (params.location?.trim()) {
    const location = params.location.trim();
    const safeLocation = safePostgrestValue(location);
    const baseLocationQuery = () => supabase.from("supplier_listings").select("id").eq("category_slug", "photographer").eq("listing_status", "published");
    const [nearby, serviceArea] = await Promise.all([
      baseLocationQuery().or(`travels_nationwide.eq.true,region.ilike.%${safeLocation}%,base_town.ilike.%${safeLocation}%`),
      baseLocationQuery().overlaps("service_areas", [location])
    ]);
    locationSupplierIds = [...new Set([...(nearby.data ?? []), ...(serviceArea.data ?? [])].map((supplier) => supplier.id))];
    if (locationSupplierIds.length === 0) return { suppliers: [], total: 0, page, totalPages: 1 };
  }

  let query = supabase
    .from("supplier_listings")
    .select(LISTING_COLUMNS, { count: "exact" })
    .eq("category_slug", "photographer")
    .eq("listing_status", "published");

  if (styleSupplierIds) query = query.in("id", styleSupplierIds);
  if (venueSupplierIds) query = query.in("id", venueSupplierIds);
  if (locationSupplierIds) query = query.in("id", locationSupplierIds);

  const budget = Number(params.budget);
  if (Number.isFinite(budget) && budget > 0) query = query.not("starting_price_pence", "is", null).lte("starting_price_pence", Math.round(budget * 100));

  if (params.sort === "price-desc") query = query.order("starting_price_pence", { ascending: false, nullsFirst: false });
  else if (params.sort === "name") query = query.order("name", { ascending: true });
  else if (params.sort === "newest") query = query.order("updated_at", { ascending: false });
  else query = query.order("starting_price_pence", { ascending: true, nullsFirst: false }).order("is_featured", { ascending: false });

  const { data, count, error } = await query.range(from, to);
  if (error || !data) return { suppliers: [], total: 0, page, totalPages: 1, error: error?.message ?? "Supplier data could not be loaded." };

  const rows = data as SupplierRow[];
  const photographers = await fetchPhotographerProfiles(supabase, rows.map((row) => row.id));
  const total = count ?? rows.length;
  return {
    suppliers: rows.map((row) => supplierFromRow(row, photographers.get(row.id) ?? null)),
    total,
    page,
    totalPages: Math.max(Math.ceil(total / pageSize), 1)
  };
}

export async function getPhotographerVenueOptions(): Promise<PhotographerVenueOption[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("venues")
    .select("id, name, town, region")
    .eq("status", "published")
    .in("listing_status", ["published", "claimed"])
    .order("region", { ascending: true })
    .order("name", { ascending: true })
    .limit(1000);
  return data ?? [];
}

export async function getPhotographerListingBySlug(slug: string): Promise<SupplierListing | undefined> {
  const supabase = await createClient();
  if (!supabase) return undefined;

  const { data } = await supabase
    .from("supplier_listings")
    .select(LISTING_COLUMNS)
    .eq("category_slug", "photographer")
    .eq("listing_status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return undefined;

  const row = data as SupplierRow;
  const [{ data: photographer }, { data: images }, { data: connections }] = await Promise.all([
    supabase.from("photographer_profiles").select("*").eq("supplier_id", row.id).maybeSingle(),
    supabase.from("supplier_images").select("*").eq("supplier_id", row.id).eq("permission_status", "approved").order("sort_order", { ascending: true }),
    supabase.from("supplier_venue_connections").select("venue_id, connection_type").eq("supplier_id", row.id).eq("status", "verified")
  ]);

  const venueIds = (connections ?? []).map((connection) => connection.venue_id);
  const { data: venues } = venueIds.length
    ? await supabase.from("venues").select("id, slug, name, town").in("id", venueIds).eq("status", "published")
    : { data: [] };
  const venuesById = new Map((venues ?? []).map((venue) => [venue.id, venue]));

  return supplierFromRow(
    row,
    photographer ? photographerFromRow(photographer as PhotographerRow) : null,
    (images ?? []) as SupplierImageRow[],
    (connections ?? []).flatMap((connection) => {
      const venue = venuesById.get(connection.venue_id);
      return venue ? [{
        venueId: venue.id,
        venueName: venue.name,
        venueSlug: venue.slug,
        venueTown: venue.town,
        connectionType: connection.connection_type
      }] : [];
    })
  );
}

export async function getBudgetPlannerSupplierListings(): Promise<PlannerListing[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("supplier_listings")
    .select("id, slug, name, category_slug, base_town, region, hero_image_url, starting_price_pence, typical_price_pence, pricing_summary, pricing_unit")
    .eq("listing_status", "published")
    .order("is_featured", { ascending: false })
    .order("name", { ascending: true })
    .limit(1000);

  return (data ?? []).map((supplier) => ({
    id: supplier.id,
    slug: supplier.slug,
    name: supplier.name,
    type: supplier.category_slug === "photographer" ? "Photographer" : supplier.category_slug,
    categoryId: supplier.category_slug === "photographer" ? "photography" : supplier.category_slug,
    location: `${supplier.base_town}, ${supplier.region}`,
    imageUrl: supplier.hero_image_url ?? "/everaft-logo-mark.svg",
    listingUrl: supplier.category_slug === "photographer" ? `/photographers/${supplier.slug}` : `/suppliers/${supplier.category_slug}/${supplier.slug}`,
    priceFromPence: supplier.starting_price_pence,
    priceToPence: supplier.typical_price_pence,
    pricingStatus: supplier.pricing_unit === "quote" ? "quote_required" : supplier.starting_price_pence == null ? "unavailable" : supplier.typical_price_pence != null && supplier.typical_price_pence > supplier.starting_price_pence ? "range" : "starting_from",
    pricingKind: "supplier_package",
    pricingLabel: supplier.starting_price_pence == null ? null : "Packages from",
    pricingUnit: supplier.pricing_unit === "person" ? "per_person" : supplier.pricing_unit,
    priceQualifier: supplier.starting_price_pence == null ? "quote" : "from",
    pricingDescription: supplier.pricing_summary,
    verifiedAt: null
  }));
}

function supplierFromRow(
  row: SupplierRow,
  photographer: PhotographerProfile | null,
  images: SupplierImageRow[] = [],
  venues: SupplierListing["venues"] = []
): SupplierListing {
  return {
    id: row.id,
    categorySlug: row.category_slug as SupplierListing["categorySlug"],
    slug: row.slug,
    name: row.name,
    baseTown: row.base_town,
    region: row.region,
    country: row.country,
    serviceAreas: row.service_areas,
    travelRadiusMiles: row.travel_radius_miles,
    travelsNationwide: row.travels_nationwide,
    summary: row.summary,
    description: row.description,
    services: row.services,
    officialWebsiteUrl: row.official_website_url,
    instagramUrl: row.instagram_url,
    facebookUrl: row.facebook_url,
    enquiryUrl: row.enquiry_url,
    startingPricePence: row.starting_price_pence,
    typicalPricePence: row.typical_price_pence,
    pricingSummary: row.pricing_summary,
    pricingUnit: row.pricing_unit,
    heroImageUrl: row.hero_image_url,
    imageCredit: row.image_credit,
    isClaimed: row.is_claimed,
    isFeatured: row.is_featured,
    photographer,
    images: images.map((image) => ({ id: image.id, url: image.url, alt: image.alt, creditText: image.credit_text, sortOrder: image.sort_order })),
    venues,
    updatedAt: row.updated_at
  };
}

async function fetchPhotographerProfiles(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  supplierIds: string[]
) {
  const result = new Map<string, PhotographerProfile>();
  if (supplierIds.length === 0) return result;
  const { data } = await supabase.from("photographer_profiles").select("*").in("supplier_id", supplierIds);
  for (const row of (data ?? []) as PhotographerRow[]) result.set(row.supplier_id, photographerFromRow(row));
  return result;
}

function photographerFromRow(row: PhotographerRow): PhotographerProfile {
  return {
    styles: row.styles,
    coverageHoursMin: row.coverage_hours_min,
    coverageHoursMax: row.coverage_hours_max,
    secondPhotographerAvailable: row.second_photographer_available,
    engagementShootAvailable: row.engagement_shoot_available,
    droneAvailable: row.drone_available,
    filmPhotographyAvailable: row.film_photography_available,
    albumsAvailable: row.albums_available,
    turnaroundWeeksMin: row.turnaround_weeks_min,
    turnaroundWeeksMax: row.turnaround_weeks_max
  };
}

function safePostgrestValue(value: string) {
  return value.replace(/[%_,().\\]/g, " ").trim();
}
