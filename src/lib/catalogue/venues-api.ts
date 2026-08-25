import {
  catalogueVenueCollectionSchema,
  catalogueVenueDetailSchema,
} from "@everaft/planning-contracts/catalogue/venue-api-schema";
import type { PlanningHubSearchParams, PlanningHubVenue, PlanningHubVenueDetail } from "@/lib/planning-hub/types";

const allowedSearchKeys = new Set([
  "search",
  "location",
  "guests",
  "budget",
  "type",
  "page",
]);

export function parseCatalogueVenueSearch(request: Request): PlanningHubSearchParams | null {
  const values = new URL(request.url).searchParams;
  if ([...values.keys()].some((key) => !allowedSearchKeys.has(key))) return null;
  if ([...allowedSearchKeys].some((key) => values.getAll(key).length > 1)) return null;

  const page = values.get("page");
  const guests = values.get("guests");
  const budget = values.get("budget");
  if (page && (!/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 1000)) return null;
  if (guests && (!/^\d+$/.test(guests) || Number(guests) < 1 || Number(guests) > 10_000)) return null;
  if (budget && (!/^\d+$/.test(budget) || Number(budget) < 1 || Number(budget) > 10_000_000)) return null;

  return Object.fromEntries(
    [...allowedSearchKeys]
      .map((key) => [key, values.get(key)?.trim() || undefined] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export function catalogueVenueCollection(
  request: Request,
  result: Readonly<{
    venues: PlanningHubVenue[];
    total: number;
    page: number;
    totalPages: number;
  }>,
) {
  return catalogueVenueCollectionSchema.parse({
    schemaVersion: 1,
    venues: result.venues.map((venue) => catalogueVenue(request, venue)),
    page: {
      number: result.page,
      size: 8,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
}

export function catalogueVenueDetail(request: Request, detail: PlanningHubVenueDetail) {
  return catalogueVenueDetailSchema.parse({
    ...catalogueVenue(request, detail),
    description: detail.description,
    capacityMin: detail.capacityMin,
    officialWebsiteUrl: detail.officialWebsiteUrl,
    imageCredit: detail.imageCredit,
    gallery: detail.imageStatus === "absent"
      ? []
      : detail.gallery.map((image) => ({
          ...image,
          url: absoluteUrl(request, image.url),
        })),
    amenities: detail.amenities,
  });
}

function catalogueVenue(request: Request, venue: PlanningHubVenue) {
  const imageStatus = venue.imageStatus
    ?? (venue.hasApprovedPhoto ? "approved" : "representative");
  return {
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    town: venue.town,
    region: venue.region,
    summary: venue.summary,
    capacityMax: venue.capacityMax,
    imageUrl: imageStatus === "absent" || !venue.imageUrl
      ? null
      : absoluteUrl(request, venue.imageUrl),
    imageStatus,
    priceFromPence: venue.priceFromPence,
    pricingLabel: venue.pricingLabel,
    pricingUnit: venue.pricingUnit,
  };
}

function absoluteUrl(request: Request, value: string) {
  return new URL(value, request.url).href;
}
