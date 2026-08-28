import { z } from "zod";

export const catalogueSupplierVisualStatusSchema = z.enum([
  "approved",
  "representative",
  "absent",
]);

export const catalogueSupplierSchema = z.strictObject({
  id: z.string().uuid(),
  categorySlug: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(1).max(180),
  name: z.string().trim().min(1).max(240),
  baseTown: z.string().trim().max(160),
  region: z.string().trim().max(160),
  summary: z.string().trim().max(2_000),
  styles: z.array(z.string().trim().min(1).max(80)).max(30),
  imageUrl: z.url().nullable(),
  visualStatus: catalogueSupplierVisualStatusSchema,
  startingPricePence: z.number().int().nonnegative().nullable(),
  typicalPricePence: z.number().int().nonnegative().nullable(),
  pricingSummary: z.string().trim().max(1_000).nullable(),
  pricingUnit: z.string().trim().max(80),
  isClaimed: z.boolean(),
  travelsNationwide: z.boolean(),
  availabilityStatus: z.literal("not_checked"),
});

export const catalogueSupplierContextSchema = z.strictObject({
  venue: z.enum(["not_provided", "matched", "stale"]),
  venueName: z.string().trim().max(240).nullable(),
  location: z.string().trim().max(120).nullable(),
  budgetPence: z.number().int().nonnegative().nullable(),
  weddingDate: z.iso.date().nullable(),
  availabilityStatus: z.literal("not_checked"),
});

export const catalogueSupplierCollectionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  category: z.strictObject({
    slug: z.literal("photographer"),
    label: z.literal("Photographer"),
    plural: z.literal("Photographers"),
    budgetCategoryId: z.literal("photography"),
  }),
  suppliers: z.array(catalogueSupplierSchema).max(8),
  context: catalogueSupplierContextSchema,
  page: z.strictObject({
    number: z.number().int().min(1),
    size: z.literal(8),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().min(1),
  }),
});

export const catalogueSupplierDetailSchema = catalogueSupplierSchema.extend({
  description: z.string().trim().max(20_000),
  services: z.array(z.string().trim().min(1).max(160)).max(100),
  officialWebsiteUrl: z.url().nullable(),
  enquiryUrl: z.url().nullable(),
  imageCredit: z.string().trim().max(500).nullable(),
  gallery: z.array(z.strictObject({
    id: z.string().min(1).max(200),
    url: z.url(),
    alt: z.string().trim().max(500),
  })).max(12),
  coverageHoursMin: z.number().int().nonnegative().nullable(),
  coverageHoursMax: z.number().int().nonnegative().nullable(),
  turnaroundWeeksMin: z.number().int().nonnegative().nullable(),
  turnaroundWeeksMax: z.number().int().nonnegative().nullable(),
});
