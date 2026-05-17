export type VenueType = "Castle" | "Barn" | "Luxury Hotel" | "Country Estate";

export type Amenity = {
  id: string;
  name: string;
  icon?: string;
};

export type VenueImage = {
  id: string;
  venueId: string;
  url: string;
  alt: string;
  sortOrder: number;
};

export type Venue = {
  id: string;
  slug: string;
  name: string;
  type: VenueType;
  region: string;
  town: string;
  country: "Scotland";
  summary: string;
  description: string;
  priceFrom: number;
  priceTo: number;
  capacityMin: number;
  capacityMax: number;
  heroImage: string;
  officialWebsiteUrl?: string;
  officialGalleryUrl?: string;
  vendorContactEmail?: string;
  listingStatus: "draft" | "published" | "claimed" | "archived";
  claimStatus: "unclaimed" | "pending" | "approved" | "rejected";
  imagePermissionStatus: string;
  imageCredit?: string;
  imageIsRepresentative: boolean;
  isClaimed: boolean;
  claimedBy?: string;
  claimedAt?: string;
  inviteSentAt?: string;
  inviteStatus: "not_sent" | "sent" | "bounced" | "replied" | "claimed";
  images: VenueImage[];
  amenities: Amenity[];
  latitude?: number;
  longitude?: number;
  isFeatured: boolean;
};

export type VenueSearchParams = {
  location?: string;
  guests?: string;
  budget?: string;
  type?: string;
  sort?: "price-asc" | "price-desc" | "capacity-desc";
  page?: string;
};
