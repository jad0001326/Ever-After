export type SupplierCategorySlug =
  | "photographer"
  | "videographer"
  | "celebrant"
  | "florist"
  | "wedding-planner"
  | "band-musician"
  | "dj"
  | "caterer"
  | "cake-maker"
  | "styling-decor"
  | "transport"
  | "bridal-boutique"
  | "hair-makeup"
  | "stationery"
  | "entertainment"
  | "jeweller";

export type PhotographerProfile = {
  styles: string[];
  coverageHoursMin: number | null;
  coverageHoursMax: number | null;
  secondPhotographerAvailable: boolean | null;
  engagementShootAvailable: boolean | null;
  droneAvailable: boolean | null;
  filmPhotographyAvailable: boolean | null;
  albumsAvailable: boolean | null;
  turnaroundWeeksMin: number | null;
  turnaroundWeeksMax: number | null;
};

export type SupplierVenueConnection = {
  venueId: string;
  venueName: string;
  venueSlug: string;
  venueTown: string;
  connectionType: "worked_at" | "preferred_supplier" | "recommended";
};

export type SupplierImage = {
  id: string;
  url: string;
  alt: string;
  creditText: string | null;
  sortOrder: number;
};

export type SupplierListing = {
  id: string;
  categorySlug: SupplierCategorySlug;
  slug: string;
  name: string;
  baseTown: string;
  region: string;
  country: string;
  serviceAreas: string[];
  travelRadiusMiles: number | null;
  travelsNationwide: boolean;
  summary: string;
  description: string;
  services: string[];
  officialWebsiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  enquiryUrl: string | null;
  startingPricePence: number | null;
  typicalPricePence: number | null;
  pricingSummary: string | null;
  pricingUnit: "package" | "hour" | "person" | "item" | "event" | "quote";
  heroImageUrl: string | null;
  imageCredit: string | null;
  isClaimed: boolean;
  isFeatured: boolean;
  photographer: PhotographerProfile | null;
  images: SupplierImage[];
  venues: SupplierVenueConnection[];
  updatedAt: string;
};

export type PhotographerSearchParams = {
  venue?: string;
  location?: string;
  style?: string;
  budget?: string;
  sort?: "price-asc" | "price-desc" | "name" | "newest";
  page?: string;
};

export type PhotographerVenueOption = {
  id: string;
  name: string;
  town: string;
  region: string;
};
