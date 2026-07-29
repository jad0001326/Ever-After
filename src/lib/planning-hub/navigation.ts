import type { BudgetPlan } from "@/lib/budget/types";
import type { PlanningHubSupplierDiscoveryParams } from "./supplier-search";
import { calculatePlanningHubPlan } from "./plan";

export function withPlanningWorkspace(href: string, workspaceId?: string | null) {
  if (!workspaceId) return href;
  const url = new URL(href, "https://planning-hub.local");
  url.searchParams.set("workspace", workspaceId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getPhotographyNextHref(
  plan: BudgetPlan,
  preferredStyle?: string | null,
  workspaceId?: string | null,
) {
  const params = new URLSearchParams();
  if (preferredStyle) params.set("style", preferredStyle);
  if (workspaceId) {
    params.set("workspace", workspaceId);
  } else {
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
    const remainingPence = calculatePlanningHubPlan(plan).remainingPence;

    params.set("context", "plan");
    params.set("remainingPence", String(remainingPence));
    if (selectedVenue?.listingId) params.set("venue", selectedVenue.listingId);
    if (selectedVenue?.itemName) params.set("venueName", selectedVenue.itemName);
    if (plan.weddingDate) params.set("planDate", plan.weddingDate);
    if (plan.location) params.set("planLocation", plan.location);
  }
  return `/planning-hub/photography${params.size ? `?${params.toString()}` : ""}`;
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
