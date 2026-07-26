import { supplierCategoryBySlug } from "@/data/supplier-directory";
import type { SupplierCategorySlug } from "@/types/supplier";
import type { PlanningHubSupplierSearchParams } from "./types";

export const PLANNING_HUB_SUPPLIER_PAGE_SIZE = 8;

export function normalisePlanningHubSupplierSearchParams(
  params: PlanningHubSupplierSearchParams,
) {
  const page = positiveInteger(params.page, 1_000) ?? 1;
  const budgetPounds = positiveInteger(params.budget, 10_000_000);
  const sort = params.sort === "price-desc"
    || params.sort === "name"
    || params.sort === "newest"
    ? params.sort
    : "price-asc";

  return {
    search: cleanText(params.search, 100),
    venue: cleanText(params.venue, 100),
    location: cleanText(params.location, 120),
    budgetPence: budgetPounds === null ? null : budgetPounds * 100,
    sort,
    page,
  };
}

export function getPlanningHubSupplierCategory(categorySlug: string) {
  return supplierCategoryBySlug(categorySlug) ?? null;
}

export function getLivePlanningHubSupplierCategory(categorySlug: string) {
  const category = getPlanningHubSupplierCategory(categorySlug);
  return category?.live ? category : null;
}

export function isSupplierCategorySlug(value: string): value is SupplierCategorySlug {
  return getPlanningHubSupplierCategory(value) !== null;
}

function cleanText(value: string | undefined, maximumLength: number) {
  return value?.trim().replace(/\s+/g, " ").slice(0, maximumLength) ?? "";
}

function positiveInteger(value: string | undefined, maximum: number) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, maximum);
}
