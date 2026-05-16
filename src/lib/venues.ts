import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { Amenity, Venue, VenueSearchParams } from "@/types/venue";

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type VenueImageRow = Database["public"]["Tables"]["venue_images"]["Row"];

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

  let query = supabase.from("venues").select("*", { count: "exact" }).eq("status", "published");

  if (params.location) {
    const value = `%${params.location}%`;
    query = query.or(`region.ilike.${value},town.ilike.${value},country.ilike.${value}`);
  }

  const guests = Number(params.guests);
  if (!Number.isNaN(guests) && guests > 0) query = query.gte("capacity_max", guests);

  const budget = Number(params.budget);
  if (!Number.isNaN(budget) && budget > 0) query = query.lte("price_from", budget);

  if (params.type) query = query.eq("type", params.type);

  if (params.sort === "price-desc") query = query.order("price_from", { ascending: false });
  else if (params.sort === "capacity-desc") query = query.order("capacity_max", { ascending: false });
  else query = query.order("price_from", { ascending: true });

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

  const total = count ?? data.length;
  return {
    venues: data.map((row) => venueFromRow(row)),
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
    .eq("is_featured", true)
    .order("updated_at", { ascending: false })
    .limit(3);

  return {
    venues: data?.map((row) => venueFromRow(row)) ?? [],
    error: error?.message
  };
}

export async function getVenueListingBySlug(slug: string): Promise<Venue | undefined> {
  const supabase = await createClient();
  if (!supabase) return undefined;

  const { data: venue } = await supabase.from("venues").select("*").eq("slug", slug).eq("status", "published").single();
  if (!venue) return undefined;

  const [{ data: images }, { data: links }, { data: amenityRows }] = await Promise.all([
    supabase.from("venue_images").select("*").eq("venue_id", venue.id).order("sort_order", { ascending: true }),
    supabase.from("venue_amenities").select("*").eq("venue_id", venue.id),
    supabase.from("amenities").select("*")
  ]);

  const amenityIds = new Set((links ?? []).map((link) => link.amenity_id));
  const mappedAmenities = (amenityRows ?? [])
    .filter((amenity) => amenityIds.has(amenity.id))
    .map((amenity) => ({ id: amenity.slug, name: amenity.name }));

  return venueFromRow(venue, images ?? [], mappedAmenities);
}

function venueFromRow(row: VenueRow, images: VenueImageRow[] = [], amenities: Amenity[] = []): Venue {
  const gallery = images.length
    ? images.map((image) => ({ id: image.id, venueId: image.venue_id, url: image.url, alt: image.alt, sortOrder: image.sort_order }))
    : [{ id: `${row.id}-hero`, venueId: row.id, url: row.hero_image, alt: row.name, sortOrder: 0 }];

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
    capacityMin: row.capacity_min,
    capacityMax: row.capacity_max,
    heroImage: row.hero_image,
    images: gallery,
    amenities,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    isFeatured: row.is_featured
  };
}
