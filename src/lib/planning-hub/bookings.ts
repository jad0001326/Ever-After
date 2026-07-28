import { getItemPlanningCost } from "@/lib/budget/calculations";
import type {
  BookingStatus,
  BudgetPlan,
  PaymentStatus,
} from "@/lib/budget/types";
import { getPlanningHubItemStageHref } from "./item-navigation";
import { calculatePlanningHubPlan } from "./plan";

export type PlanningHubBookingEntry = {
  itemId: string;
  itemName: string;
  categoryLabel: string;
  bookingStatus: Exclude<BookingStatus, "cancelled">;
  paymentStatus: PaymentStatus;
  costPence: number | null;
  paidPence: number;
  outstandingPence: number | null;
  selectedVenue: boolean;
  stageHref: string | null;
};

export type PlanningHubBookingOverview = {
  budget: ReturnType<typeof calculatePlanningHubPlan>;
  items: PlanningHubBookingEntry[];
  bookedCount: number;
  quotedCount: number;
  shortlistedCount: number;
  researchingCount: number;
};

const bookingRank: Record<PlanningHubBookingEntry["bookingStatus"], number> = {
  booked: 0,
  quoted: 1,
  shortlisted: 2,
  researching: 3,
};

export function getPlanningHubBookingOverview(
  plan: BudgetPlan,
  workspaceId?: string | null,
): PlanningHubBookingOverview {
  const categoryNames = new Map(
    plan.categories.map((category) => [category.id, category.name]),
  );
  const items: PlanningHubBookingEntry[] = [];
  let bookedCount = 0;
  let quotedCount = 0;
  let shortlistedCount = 0;
  let researchingCount = 0;

  for (const item of plan.items) {
    if (item.bookingStatus === "cancelled" || item.costStatus === "cancelled") continue;
    if (item.bookingStatus === "booked") bookedCount += 1;
    else if (item.bookingStatus === "quoted") quotedCount += 1;
    else if (item.bookingStatus === "shortlisted") shortlistedCount += 1;
    else researchingCount += 1;

    const costPence = getItemPlanningCost(item).amountPence;
    const paidPence = Math.max(item.totalPaidPence, item.depositPaidPence, 0);
    items.push({
      itemId: item.id,
      itemName: item.itemName,
      categoryLabel: item.supplierType
        ?? categoryNames.get(item.categoryId)
        ?? item.categoryId.replaceAll("-", " "),
      bookingStatus: item.bookingStatus,
      paymentStatus: item.paymentStatus,
      costPence,
      paidPence,
      outstandingPence: costPence === null
        ? null
        : Math.max(costPence - paidPence, 0),
      selectedVenue: item.categoryId === "venue"
        && (plan.selectedVenueId === item.id || plan.selectedVenueId === item.listingId),
      stageHref: getPlanningHubItemStageHref(item, workspaceId),
    });
  }

  items.sort((left, right) => {
    const rankDifference = bookingRank[left.bookingStatus] - bookingRank[right.bookingStatus];
    if (rankDifference !== 0) return rankDifference;
    if (left.selectedVenue !== right.selectedVenue) return left.selectedVenue ? -1 : 1;
    return left.itemName.localeCompare(right.itemName);
  });

  return {
    budget: calculatePlanningHubPlan(plan),
    items,
    bookedCount,
    quotedCount,
    shortlistedCount,
    researchingCount,
  };
}

export function getPlanningHubBookingStatusLabel(
  status: PlanningHubBookingEntry["bookingStatus"],
) {
  if (status === "booked") return "Booked";
  if (status === "quoted") return "Quote received";
  if (status === "shortlisted") return "Shortlisted";
  return "Researching";
}
