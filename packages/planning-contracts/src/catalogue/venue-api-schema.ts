import { z } from "zod";

export const catalogueImageStatusSchema = z.enum([
  "approved",
  "representative",
  "absent",
]);

export const catalogueVenueSchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string().trim().min(1).max(180),
  name: z.string().trim().min(1).max(240),
  type: z.string().trim().min(1).max(120),
  town: z.string().trim().min(1).max(160),
  region: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(2000),
  capacityMax: z.number().int().positive(),
  imageUrl: z.url().nullable(),
  imageStatus: catalogueImageStatusSchema,
  priceFromPence: z.number().int().nonnegative().nullable(),
  pricingLabel: z.string().trim().max(240).nullable(),
  pricingUnit: z.string().trim().max(80).nullable(),
});

export const catalogueVenueCollectionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  venues: z.array(catalogueVenueSchema).max(8),
  page: z.strictObject({
    number: z.number().int().min(1),
    size: z.literal(8),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().min(1),
  }),
});

export const catalogueVenueDetailSchema = catalogueVenueSchema.extend({
  description: z.string().trim().max(20_000),
  capacityMin: z.number().int().nonnegative(),
  officialWebsiteUrl: z.url().nullable(),
  imageCredit: z.string().trim().max(500).nullable(),
  gallery: z.array(z.strictObject({
    id: z.string().min(1).max(200),
    url: z.url(),
    alt: z.string().trim().max(500),
  })).max(12),
  amenities: z.array(z.string().trim().min(1).max(160)).max(100),
});

export const catalogueFavouriteKindSchema = z.enum(["venue", "supplier"]);

export const catalogueFavouriteCollectionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  venueIds: z.array(z.string().uuid()).max(100),
  supplierIds: z.array(z.string().uuid()).max(100),
  hasMore: z.strictObject({
    venues: z.boolean(),
    suppliers: z.boolean(),
  }),
});

export const catalogueFavouriteMutationSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: catalogueFavouriteKindSchema,
  id: z.string().uuid(),
  saved: z.boolean(),
});
