import { supplierDirectoryCategories } from "@/data/supplier-directory";
import { getItemPlanningCost } from "@/lib/budget/calculations";
import type { BudgetItem, BudgetPlan } from "@/lib/budget/types";

export type PlanningHubSupplierRoadmapEntry = {
  slug: (typeof supplierDirectoryCategories)[number]["slug"];
  label: string;
  plural: string;
  catalogueLive: boolean;
  itemCount: number;
  latestItem: BudgetItem | null;
  planningCostPence: number | null;
  href: string;
};

export function getPlanningHubSupplierRoadmap(
  plan: BudgetPlan,
  workspaceId?: string | null,
): PlanningHubSupplierRoadmapEntry[] {
  return supplierDirectoryCategories.map((category) => {
    const items = plan.items.filter((item) => (
      item.categoryId === category.budgetCategoryId
      && item.supplierType === category.label
      && item.bookingStatus !== "cancelled"
    ));
    const latestItem = items.at(-1) ?? null;

    return {
      slug: category.slug,
      label: category.label,
      plural: category.plural,
      catalogueLive: category.live,
      itemCount: items.length,
      latestItem,
      planningCostPence: latestItem
        ? getItemPlanningCost(latestItem).amountPence
        : null,
      href: supplierRoadmapHref(
        category.slug,
        category.live,
        latestItem?.id ?? null,
        workspaceId,
      ),
    };
  });
}

function supplierRoadmapHref(
  categorySlug: PlanningHubSupplierRoadmapEntry["slug"],
  catalogueLive: boolean,
  planItemId: string | null,
  workspaceId?: string | null,
) {
  const path = categorySlug === "photographer"
    ? "/planning-hub/photography"
    : `/planning-hub/suppliers/${categorySlug}`;
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspace", workspaceId);
  if (planItemId) params.set("planItem", planItemId);
  const hash = categorySlug === "photographer"
    ? planItemId ? "#current-photography-planning" : ""
    : planItemId
      ? "#current-supplier-planning"
      : catalogueLive
        ? ""
        : `#manual-${categorySlug}`;
  return `${path}${params.size ? `?${params.toString()}` : ""}${hash}`;
}
