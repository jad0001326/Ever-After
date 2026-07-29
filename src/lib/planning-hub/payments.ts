import { getPaymentDeadlines } from "@/lib/budget/calculations";
import type { BudgetPlan } from "@/lib/budget/types";
import type { PaymentDeadline } from "@/lib/budget/calculations";
import { getPlanningHubItemStageHref } from "./item-navigation";
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
  if (!item) {
    return withPlanningWorkspace(
      "/planning-hub/organise#planning-hub-payment-commitments",
      workspaceId,
    );
  }
  const stageHref = getPlanningHubItemStageHref(item, workspaceId);
  if (!stageHref) {
    return withPlanningWorkspace(
      "/planning-hub/organise#planning-hub-payment-commitments",
      workspaceId,
    );
  }
  const url = new URL(stageHref, "https://planning-hub.local");
  url.hash = paymentEditorAnchor(item.categoryId);
  return `${url.pathname}${url.search}${url.hash}`;
}

function paymentEditorAnchor(categoryId: string) {
  if (categoryId === "venue") return "current-venue-payments";
  if (categoryId === "photography") return "current-photographer-payments";
  return "current-supplier-payments";
}
