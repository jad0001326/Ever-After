import { venues } from "@/data/venues";
import type { Venue, VenueSearchParams } from "@/types/venue";

const perPage = 6;

export function searchVenues(params: VenueSearchParams) {
  let results = [...venues];

  if (params.location) {
    const location = params.location.toLowerCase();
    results = results.filter((venue) =>
      [venue.region, venue.town, venue.country].some((field) => field.toLowerCase().includes(location))
    );
  }

  const guests = Number(params.guests);
  if (!Number.isNaN(guests) && guests > 0) {
    results = results.filter((venue) => venue.capacityMax >= guests);
  }

  const budget = Number(params.budget);
  if (!Number.isNaN(budget) && budget > 0) {
    results = results.filter((venue) => venue.priceFrom <= budget);
  }

  if (params.type) {
    results = results.filter((venue) => venue.type === params.type);
  }

  results = sortVenues(results, params.sort);

  const page = Math.max(Number(params.page) || 1, 1);
  const totalPages = Math.max(Math.ceil(results.length / perPage), 1);
  const pagedVenues = results.slice((page - 1) * perPage, page * perPage);

  return { venues: pagedVenues, total: results.length, page, totalPages };
}

function sortVenues(results: Venue[], sort: VenueSearchParams["sort"]) {
  if (sort === "price-desc") return results.sort((a, b) => b.priceFrom - a.priceFrom);
  if (sort === "capacity-desc") return results.sort((a, b) => b.capacityMax - a.capacityMax);
  return results.sort((a, b) => a.priceFrom - b.priceFrom);
}

export function getVenueBySlug(slug: string) {
  return venues.find((venue) => venue.slug === slug);
}

export function buildVenueHref(params: VenueSearchParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return `/venues${query ? `?${query}` : ""}`;
}
