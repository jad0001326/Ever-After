export type SupplierAuditCategory = {
  slug: string;
  name: string;
  plural_name: string;
  is_live: boolean;
  sort_order: number;
};

export type SupplierAuditListing = {
  id: string;
  category_slug: string;
  name: string;
  base_town: string;
  region: string;
  summary: string;
  description: string;
  services: string[];
  source_url: string | null;
  official_website_url: string | null;
  starting_price_pence: number | null;
  typical_price_pence: number | null;
  pricing_summary: string | null;
  pricing_unit: string;
  hero_image_url: string | null;
  image_permission_status: "representative" | "pending" | "approved" | "rejected";
  listing_status: "draft" | "published" | "archived";
  claim_status: "unclaimed" | "pending" | "approved" | "rejected";
  is_claimed: boolean;
};

export type SupplierAuditImage = {
  supplier_id: string;
  permission_status: "pending" | "approved" | "rejected";
};

export type SupplierAuditClaim = {
  supplier_id: string;
  status: "pending" | "approved" | "rejected";
};

export type SupplierCatalogueCategoryAudit = {
  slug: string;
  name: string;
  databaseLive: boolean;
  total: number;
  draft: number;
  published: number;
  archived: number;
  claimed: number;
  openClaims: number;
  withLocation: number;
  withSummary: number;
  withDescription: number;
  withServices: number;
  withSourceProvenance: number;
  withPricingOrQuoteHandling: number;
  withApprovedOrRepresentativeVisual: number;
  completePublishedProfiles: number;
  potentialDuplicateGroups: number;
};

export type SupplierCatalogueAudit = {
  generatedAt: string;
  totals: {
    categories: number;
    databaseLiveCategories: number;
    listings: number;
    draft: number;
    published: number;
    archived: number;
    claimed: number;
    openClaims: number;
    approvedImages: number;
    completePublishedProfiles: number;
  };
  categories: SupplierCatalogueCategoryAudit[];
};

export function buildSupplierCatalogueAudit(input: {
  generatedAt: string;
  categories: SupplierAuditCategory[];
  listings: SupplierAuditListing[];
  images: SupplierAuditImage[];
  claims: SupplierAuditClaim[];
}): SupplierCatalogueAudit {
  const approvedImageSupplierIds = new Set(
    input.images
      .filter((image) => image.permission_status === "approved")
      .map((image) => image.supplier_id),
  );
  const openClaimSupplierIds = new Set(
    input.claims
      .filter((claim) => claim.status === "pending")
      .map((claim) => claim.supplier_id),
  );
  const knownCategories = new Map(input.categories.map((category) => [category.slug, category]));
  for (const listing of input.listings) {
    if (!knownCategories.has(listing.category_slug)) {
      knownCategories.set(listing.category_slug, {
        slug: listing.category_slug,
        name: listing.category_slug,
        plural_name: listing.category_slug,
        is_live: false,
        sort_order: Number.MAX_SAFE_INTEGER,
      });
    }
  }

  const categories = [...knownCategories.values()]
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
    .map((category) => auditCategory(
      category,
      input.listings.filter((listing) => listing.category_slug === category.slug),
      approvedImageSupplierIds,
      openClaimSupplierIds,
    ));

  return {
    generatedAt: input.generatedAt,
    totals: {
      categories: categories.length,
      databaseLiveCategories: categories.filter((category) => category.databaseLive).length,
      listings: sum(categories, "total"),
      draft: sum(categories, "draft"),
      published: sum(categories, "published"),
      archived: sum(categories, "archived"),
      claimed: sum(categories, "claimed"),
      openClaims: sum(categories, "openClaims"),
      approvedImages: input.images.filter((image) => image.permission_status === "approved").length,
      completePublishedProfiles: sum(categories, "completePublishedProfiles"),
    },
    categories,
  };
}

function auditCategory(
  category: SupplierAuditCategory,
  listings: SupplierAuditListing[],
  approvedImageSupplierIds: Set<string>,
  openClaimSupplierIds: Set<string>,
): SupplierCatalogueCategoryAudit {
  const readiness = listings.map((listing) => listingReadiness(listing, approvedImageSupplierIds));
  const duplicateCounts = new Map<string, number>();
  for (const listing of listings) {
    const key = [listing.name, listing.base_town]
      .map((value) => value.trim().toLocaleLowerCase("en-GB").replace(/[^a-z0-9]+/g, ""))
      .join(":");
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  }

  return {
    slug: category.slug,
    name: category.plural_name || category.name,
    databaseLive: category.is_live,
    total: listings.length,
    draft: listings.filter((listing) => listing.listing_status === "draft").length,
    published: listings.filter((listing) => listing.listing_status === "published").length,
    archived: listings.filter((listing) => listing.listing_status === "archived").length,
    claimed: listings.filter((listing) => listing.is_claimed || listing.claim_status === "approved").length,
    openClaims: listings.filter((listing) => openClaimSupplierIds.has(listing.id)).length,
    withLocation: readiness.filter((row) => row.location).length,
    withSummary: readiness.filter((row) => row.summary).length,
    withDescription: readiness.filter((row) => row.description).length,
    withServices: readiness.filter((row) => row.services).length,
    withSourceProvenance: readiness.filter((row) => row.source).length,
    withPricingOrQuoteHandling: readiness.filter((row) => row.pricing).length,
    withApprovedOrRepresentativeVisual: readiness.filter((row) => row.visual).length,
    completePublishedProfiles: readiness.filter((row) => row.complete && row.published).length,
    potentialDuplicateGroups: [...duplicateCounts.values()].filter((count) => count > 1).length,
  };
}

function listingReadiness(listing: SupplierAuditListing, approvedImageSupplierIds: Set<string>) {
  const location = present(listing.base_town) && present(listing.region);
  const summary = present(listing.summary);
  const description = present(listing.description);
  const services = listing.services.some(present);
  const source = present(listing.source_url) || present(listing.official_website_url);
  const explicitPrice = listing.starting_price_pence !== null
    || listing.typical_price_pence !== null;
  const describedQuoteHandling = listing.pricing_unit === "quote" && present(listing.pricing_summary);
  const pricing = explicitPrice || Boolean(describedQuoteHandling);
  const permittedHero = present(listing.hero_image_url)
    && ["approved", "representative"].includes(listing.image_permission_status);
  const visual = Boolean(permittedHero) || approvedImageSupplierIds.has(listing.id);
  return {
    location: Boolean(location),
    summary: Boolean(summary),
    description: Boolean(description),
    services,
    source: Boolean(source),
    pricing,
    visual,
    published: listing.listing_status === "published",
    complete: Boolean(location && summary && description && services && source && pricing && visual),
  };
}

function present(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function sum(
  rows: SupplierCatalogueCategoryAudit[],
  key: keyof Omit<SupplierCatalogueCategoryAudit, "slug" | "name" | "databaseLive">,
) {
  return rows.reduce((total, row) => total + row[key], 0);
}
