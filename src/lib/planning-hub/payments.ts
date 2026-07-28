import { supplierDirectoryCategories } from "@/data/supplier-directory";
import { getPaymentDeadlines } from "@/lib/budget/calculations";
import type { BudgetPlan } from "@/lib/budget/types";
import type { PaymentDeadline } from "@/lib/budget/calculations";
import { withPlanningWorkspace } from "./navigation";

export type PlanningHubPaymentOverview = {
  deadlines: PaymentDeadline[];
  overdueCount: number;
  dueSoonCount: number;
  upcomingCount: number;
  knownOutstandingPence: number;
  unknownAmountCount: number;
};

export function getPlanningHubPaymentOverview(
  plan: BudgetPlan,
  referenceDate = new Date(),
): PlanningHubPaymentOverview {
  const deadlines = getPaymentDeadlines(plan, referenceDate);
  let overdueCount = 0;
  let dueSoonCount = 0;
  let upcomingCount = 0;
  let knownOutstandingPence = 0;
  let unknownAmountCount = 0;

  for (const deadline of deadlines) {
    if (deadline.urgency === "overdue") overdueCount += 1;
    else if (deadline.urgency === "due_soon") dueSoonCount += 1;
    else upcomingCount += 1;

    if (deadline.outstandingPence === null) unknownAmountCount += 1;
    else knownOutstandingPence += deadline.outstandingPence;
  }

  return {
    deadlines,
    overdueCount,
    dueSoonCount,
    upcomingCount,
    knownOutstandingPence,
    unknownAmountCount,
  };
}

export function getPlanningHubPaymentDeadlineHref(
  plan: BudgetPlan,
  deadline: PaymentDeadline,
  workspaceId?: string | null,
) {
  const item = plan.items.find((candidate) => candidate.id === deadline.itemId);
  let href = "/planning-hub/organise";

  if (item?.categoryId === "venue") {
    href = "/planning-hub";
  } else if (item?.categoryId === "photography") {
    href = "/planning-hub/photography";
  } else if (item) {
    const category = supplierDirectoryCategories.find((candidate) => (
      candidate.live
      && candidate.budgetCategoryId === item.categoryId
      && candidate.label === item.supplierType
    ));
    if (category && category.slug !== "photographer") {
      href = `/planning-hub/suppliers/${category.slug}`;
    }
  }

  return withPlanningWorkspace(`${href}#payment-deadlines-title`, workspaceId);
}
