import {
  catalogueSupplierCollectionSchema,
  catalogueSupplierDetailSchema,
} from "@everaft/planning-contracts/catalogue/supplier-api-schema";
import { z } from "zod";
import { getLivePlanningHubSupplierCategory } from "@/lib/planning-hub/supplier-search";
import type { PlanningHubPhotographer, PlanningHubPhotographerDetail, PlanningHubPhotographySearchParams } from "@/lib/planning-hub/types";

const allowedSearchKeys = new Set(["search", "location", "style", "venue", "venueName", "budget", "weddingDate", "page"]);
const isoDateSchema = z.iso.date();

export function parseCatalogueSupplierSearch(request: Request): PlanningHubPhotographySearchParams | null {
  const values = new URL(request.url).searchParams;
  if ([...values.keys()].some((key) => !allowedSearchKeys.has(key))) return null;
  if ([...allowedSearchKeys].some((key) => values.getAll(key).length > 1)) return null;
  const page = values.get("page");
  const budget = values.get("budget");
  const weddingDate = values.get("weddingDate");
  if (page && (!/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 1000)) return null;
  if (budget && (!/^\d+$/.test(budget) || Number(budget) < 1 || Number(budget) > 10_000_000)) return null;
  if (weddingDate && !isoDateSchema.safeParse(weddingDate).success) return null;
  return {
    search: clean(values.get("search"), 100), location: clean(values.get("location"), 120),
    style: clean(values.get("style"), 80), venue: clean(values.get("venue"), 100),
    venueName: clean(values.get("venueName"), 120), budget: budget ?? undefined,
    planDate: weddingDate ?? undefined, page: page ?? undefined,
  };
}

export function catalogueSupplierCollection(request: Request, categorySlug: string, params: PlanningHubPhotographySearchParams, result: Readonly<{
  photographers: PlanningHubPhotographer[]; total: number; page: number; totalPages: number;
  venueContext?: "not_provided" | "matched" | "stale";
}>) {
  const category = getLivePlanningHubSupplierCategory(categorySlug);
  if (!category || category.slug !== "photographer") return null;
  return catalogueSupplierCollectionSchema.parse({
    schemaVersion: 1,
    category: {
      slug: category.slug,
      label: category.label,
      plural: category.plural,
      budgetCategoryId: category.budgetCategoryId,
    },
    suppliers: result.photographers.map((supplier) => catalogueSupplier(request, supplier)),
    context: {
      venue: result.venueContext ?? (params.venue ? "matched" : "not_provided"),
      venueName: params.venueName ?? null, location: params.location ?? null,
      budgetPence: params.budget ? Number(params.budget) * 100 : null,
      weddingDate: params.planDate ?? null, availabilityStatus: "not_checked",
    },
    page: { number: result.page, size: 8, total: result.total, totalPages: result.totalPages },
  });
}

export function catalogueSupplierDetail(request: Request, detail: PlanningHubPhotographerDetail) {
  return catalogueSupplierDetailSchema.parse({
    ...catalogueSupplier(request, detail), description: detail.description, services: detail.services,
    officialWebsiteUrl: detail.officialWebsiteUrl, enquiryUrl: detail.enquiryUrl, imageCredit: null,
    gallery: detail.gallery.map((image) => ({ ...image, url: absoluteUrl(request, image.url) })),
    coverageHoursMin: detail.coverageHoursMin, coverageHoursMax: detail.coverageHoursMax,
    turnaroundWeeksMin: detail.turnaroundWeeksMin, turnaroundWeeksMax: detail.turnaroundWeeksMax,
  });
}

function catalogueSupplier(request: Request, supplier: PlanningHubPhotographer) {
  const visualStatus = supplier.visualStatus ?? (supplier.hasApprovedPhoto ? "approved" : "absent");
  return {
    id: supplier.id, categorySlug: "photographer", slug: supplier.slug, name: supplier.name,
    baseTown: supplier.baseTown, region: supplier.region, summary: supplier.summary, styles: supplier.styles,
    imageUrl: visualStatus === "absent" ? null : absoluteUrl(request, supplier.heroImageUrl), visualStatus,
    startingPricePence: supplier.startingPricePence, typicalPricePence: supplier.typicalPricePence,
    pricingSummary: supplier.pricingSummary, pricingUnit: supplier.pricingUnit, isClaimed: supplier.isClaimed,
    travelsNationwide: supplier.travelsNationwide, availabilityStatus: "not_checked",
  };
}

function clean(value: string | null, max: number) { return value?.trim().replace(/\s+/g, " ").slice(0, max) || undefined; }
function absoluteUrl(request: Request, value: string) { return new URL(value, request.url).href; }
