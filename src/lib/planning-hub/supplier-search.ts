import { supplierCategoryBySlug } from "@/data/supplier-directory";
import { calculateBudget } from "@/lib/budget/calculations";
import type { BudgetPlan } from "@/lib/budget/types";
import type { SupplierCategorySlug } from "@/types/supplier";
import type { PlanningHubSupplierSearchParams } from "./types";

export const PLANNING_HUB_SUPPLIER_PAGE_SIZE = 8;

export type PlanningHubDerivedSupplierFilters = {
  budget: boolean;
  location: boolean;
  venue: boolean;
};

type PlanningHubSupplierDiscoveryParams = PlanningHubSupplierSearchParams & {
  style?: string;
};

export function getPlanningHubSupplierDiscoveryContext<
  TParams extends PlanningHubSupplierDiscoveryParams,
>(
  plan: BudgetPlan,
  params: TParams,
) {
  const selectedVenue = plan.selectedVenueId
    ? plan.items.find((item) => (
        item.categoryId === "venue"
        && item.bookingStatus !== "cancelled"
        && item.costStatus !== "cancelled"
        && (
          item.id === plan.selectedVenueId
          || item.listingId === plan.selectedVenueId
        )
      )) ?? null
    : null;
  const carriesPlanContext = params.context === "plan";
  const hasBudget = Boolean(params.budget?.trim());
  const hasLocation = Boolean(params.location?.trim());
  const hasVenue = Boolean(params.venue?.trim());
  const transportedRemainingPence = carriesPlanContext
    ? signedInteger(params.remainingPence, 1_000_000_000)
    : null;
  const remainingPence = carriesPlanContext
    ? transportedRemainingPence ?? 0
    : calculateBudget(plan).remainingPence;
  const planBudgetPounds = Math.floor(Math.max(remainingPence, 0) / 100);
  const transportedLocation = carriesPlanContext
    ? cleanText(params.planLocation, 120)
    : "";
  const transportedPlanDate = carriesPlanContext ? cleanDate(params.planDate) : null;
  const transportedVenueName = carriesPlanContext
    ? cleanText(params.venueName, 120)
    : "";
  const derivedFilters: PlanningHubDerivedSupplierFilters = {
    budget: !hasBudget && planBudgetPounds > 0,
    location: !hasLocation && Boolean(transportedLocation || plan.location?.trim()),
    venue: carriesPlanContext
      ? hasVenue
      : !hasVenue && Boolean(selectedVenue?.listingId),
  };

  return {
    derivedFilters,
    effectiveParams: {
      ...params,
      budget: hasBudget
        ? params.budget
        : derivedFilters.budget
          ? String(planBudgetPounds)
          : undefined,
      location: hasLocation
        ? params.location
        : transportedLocation || plan.location?.trim() || undefined,
      venue: hasVenue
        ? params.venue
        : carriesPlanContext
          ? undefined
          : selectedVenue?.listingId ?? undefined,
    } as TParams & PlanningHubSupplierSearchParams,
    navigationParams: { ...params },
    remainingPence,
    selectedVenueName: selectedVenue?.itemName ?? (transportedVenueName || null),
    weddingDate: plan.weddingDate ?? transportedPlanDate,
  };
}

export function getPlanningHubSupplierResetHref(
  route: string,
  params: PlanningHubSupplierDiscoveryParams,
) {
  const query = new URLSearchParams();
  if (params.workspace) query.set("workspace", params.workspace);
  if (params.context === "plan") {
    query.set("context", "plan");
    if (params.planDate) query.set("planDate", params.planDate);
    if (params.planLocation) query.set("planLocation", params.planLocation);
    if (params.remainingPence) query.set("remainingPence", params.remainingPence);
    if (params.venue) query.set("venue", params.venue);
    if (params.venueName) query.set("venueName", params.venueName);
  }
  return `${route}${query.size ? `?${query}` : ""}`;
}

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

function cleanDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  const [year, month, day] = value.split("-").map(Number);
  return Number.isNaN(parsed.getTime())
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
    ? null
    : value;
}

function positiveInteger(value: string | undefined, maximum: number) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, maximum);
}

function signedInteger(value: string | undefined, maximumAbsolute: number) {
  if (!value || !/^-?\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) return null;
  return Math.max(-maximumAbsolute, Math.min(parsed, maximumAbsolute));
}
