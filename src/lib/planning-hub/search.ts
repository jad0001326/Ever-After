import type { PlanningHubSearchParams } from "./types";

export const PLANNING_HUB_PAGE_SIZE = 8;

export function normalisePlanningHubSearchParams(params: PlanningHubSearchParams) {
  const page = Math.max(Number.parseInt(params.page ?? "1", 10) || 1, 1);
  const guests = clampPositiveInteger(params.guests, 10_000);
  const budgetPounds = clampPositiveInteger(params.budget, 10_000_000);

  return {
    search: cleanText(params.search, 100),
    location: cleanText(params.location, 120),
    guests,
    budgetPence: budgetPounds == null ? null : budgetPounds * 100,
    type: cleanText(params.type, 80),
    page
  };
}

export function buildPlanningHubHref(params: PlanningHubSearchParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return `/planning-hub${query ? `?${query}` : ""}`;
}

export function safePostgrestSearch(value: string) {
  return value.replace(/[%_,().\\]/g, " ").replace(/\s+/g, " ").trim();
}

function cleanText(value: string | undefined, maximumLength: number) {
  return value?.trim().slice(0, maximumLength) ?? "";
}

function clampPositiveInteger(value: string | undefined, maximum: number) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, maximum);
}
