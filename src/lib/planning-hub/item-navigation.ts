import { supplierDirectoryCategories } from "@/data/supplier-directory";
import type { BudgetItem } from "@/lib/budget/types";
import { withPlanningWorkspace } from "./navigation";

export function getPlanningHubItemStageRoute(item: BudgetItem) {
  if (item.categoryId === "venue") return "/planning-hub";
  if (item.categoryId === "photography") return "/planning-hub/photography";

  const category = supplierDirectoryCategories.find((candidate) => (
    candidate.live
    && candidate.budgetCategoryId === item.categoryId
    && candidate.label === item.supplierType
  ));
  return category && category.slug !== "photographer"
    ? `/planning-hub/suppliers/${category.slug}`
    : null;
}

export function getPlanningHubItemStageHref(
  item: BudgetItem,
  workspaceId?: string | null,
) {
  const route = getPlanningHubItemStageRoute(item);
  if (!route) return null;
  const anchor = item.categoryId === "venue"
    ? "current-venue-planning"
    : item.categoryId === "photography"
      ? "current-photographer-planning"
      : "current-supplier-planning";
  const url = new URL(route, "https://planning-hub.local");
  url.searchParams.set("planItem", item.id);
  url.hash = anchor;
  return withPlanningWorkspace(`${url.pathname}${url.search}${url.hash}`, workspaceId);
}
