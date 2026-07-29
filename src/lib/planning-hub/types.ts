import type { VenueSearchParams } from "@/types/venue";
import type { PhotographerSearchParams, SupplierCategorySlug } from "@/types/supplier";

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
  workspace?: string;
  planItem?: string;
};

export type PlanningHubVenueResults = {
  venues: PlanningHubVenue[];
  total: number;
  page: number;
  totalPages: number;
  error?: string;
};

export type PlanningHubPhotographer = {
  id: string;
  slug: string;
  name: string;
  baseTown: string;
  region: string;
  summary: string;
  styles: string[];
  heroImageUrl: string;
  hasApprovedPhoto: boolean;
  startingPricePence: number | null;
  typicalPricePence: number | null;
  pricingSummary: string | null;
  pricingUnit: string;
  isClaimed: boolean;
  travelsNationwide: boolean;
};

export type PlanningHubPhotographerDetail = PlanningHubPhotographer & {
  description: string;
  services: string[];
  officialWebsiteUrl: string | null;
  enquiryUrl: string | null;
  gallery: Array<{ id: string; url: string; alt: string }>;
  coverageHoursMin: number | null;
  coverageHoursMax: number | null;
  turnaroundWeeksMin: number | null;
  turnaroundWeeksMax: number | null;
};

export type PlanningHubPhotographySearchParams = PhotographerSearchParams & {
  context?: "plan";
  planDate?: string;
  planLocation?: string;
  remainingPence?: string;
  search?: string;
  venueName?: string;
  workspace?: string;
  planItem?: string;
};

export type PlanningHubPhotographerResults = {
  photographers: PlanningHubPhotographer[];
  total: number;
  page: number;
  totalPages: number;
  error?: string;
};

export type PlanningHubSupplier = {
  id: string;
  categorySlug: SupplierCategorySlug;
  slug: string;
  name: string;
  baseTown: string;
  region: string;
  summary: string;
  heroImageUrl: string;
  hasApprovedPhoto: boolean;
  startingPricePence: number | null;
  typicalPricePence: number | null;
  pricingSummary: string | null;
  pricingUnit: string;
  isClaimed: boolean;
  travelsNationwide: boolean;
};

export type PlanningHubSupplierDetail = PlanningHubSupplier & {
  description: string;
  services: string[];
  officialWebsiteUrl: string | null;
  enquiryUrl: string | null;
  imageCredit: string | null;
  gallery: Array<{ id: string; url: string; alt: string }>;
};

export type PlanningHubSupplierSearchParams = {
  context?: "plan";
  planDate?: string;
  planLocation?: string;
  remainingPence?: string;
  search?: string;
  venue?: string;
  location?: string;
  budget?: string;
  sort?: "price-asc" | "price-desc" | "name" | "newest";
  page?: string;
  workspace?: string;
  planItem?: string;
  venueName?: string;
};

export type PlanningHubSupplierResults = {
  suppliers: PlanningHubSupplier[];
  total: number;
  page: number;
  totalPages: number;
  error?: string;
};

export type PlanningHubSupplierCategory = {
  slug: SupplierCategorySlug;
  label: string;
  plural: string;
  budgetCategoryId: string;
};
