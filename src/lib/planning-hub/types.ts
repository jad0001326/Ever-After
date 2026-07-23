import type { VenueSearchParams } from "@/types/venue";

export type PlanningHubVenue = {
  id: string;
  slug: string;
  name: string;
  type: string;
  town: string;
  region: string;
  summary: string;
  capacityMax: number;
  imageUrl: string;
  priceFromPence: number | null;
  pricingLabel: string | null;
  pricingUnit: string | null;
  hasApprovedPhoto: boolean;
};

export type PlanningHubVenueDetail = PlanningHubVenue & {
  description: string;
  capacityMin: number;
  officialWebsiteUrl: string | null;
  imageCredit: string | null;
  gallery: Array<{ id: string; url: string; alt: string }>;
  amenities: string[];
};

export type PlanningHubSearchParams = VenueSearchParams & {
  search?: string;
};

export type PlanningHubVenueResults = {
  venues: PlanningHubVenue[];
  total: number;
  page: number;
  totalPages: number;
  error?: string;
};
