import { getItemPlanningCost } from "@/lib/budget/calculations";
import type {
  AvailabilityStatus,
  BookingStatus,
  BudgetPlan,
  PaymentStatus,
} from "@/lib/budget/types";
import { getPlanningHubItemStageHref } from "./item-navigation";
import {
  calculatePlanningHubPlan,
  getPlanningHubItemAvailability,
} from "./plan";

export type PlanningHubAvailabilityState =
  | "date_needed"
  | "not_checked"
  | "enquiry_sent"
  | "available"
  | "unavailable"
  | "stale";

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
  availabilityState: PlanningHubAvailabilityState;
};

export type PlanningHubBookingOverview = {
  budget: ReturnType<typeof calculatePlanningHubPlan>;
  items: PlanningHubBookingEntry[];
  bookedCount: number;
  quotedCount: number;
  shortlistedCount: number;
  researchingCount: number;
  availabilityAvailableCount: number;
  availabilityAwaitingCount: number;
  availabilityNeedsActionCount: number;
  availabilityUnavailableCount: number;
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
  let availabilityAvailableCount = 0;
  let availabilityAwaitingCount = 0;
  let availabilityNeedsActionCount = 0;
  let availabilityUnavailableCount = 0;

  for (const item of plan.items) {
    if (item.bookingStatus === "cancelled" || item.costStatus === "cancelled") continue;
    if (item.bookingStatus === "booked") bookedCount += 1;
    else if (item.bookingStatus === "quoted") quotedCount += 1;
    else if (item.bookingStatus === "shortlisted") shortlistedCount += 1;
    else researchingCount += 1;

    const availabilityState = getBookingAvailabilityState(
      item,
      plan.weddingDate,
    );
    if (availabilityState === "available") availabilityAvailableCount += 1;
    else if (availabilityState === "enquiry_sent") availabilityAwaitingCount += 1;
    else if (availabilityState === "unavailable") availabilityUnavailableCount += 1;
    else availabilityNeedsActionCount += 1;

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
      availabilityState,
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
    availabilityAvailableCount,
    availabilityAwaitingCount,
    availabilityNeedsActionCount,
    availabilityUnavailableCount,
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

export function getPlanningHubAvailabilityLabel(
  state: PlanningHubAvailabilityState,
) {
  if (state === "date_needed") return "Set wedding date";
  if (state === "enquiry_sent") return "Awaiting availability";
  if (state === "available") return "Available for your date";
  if (state === "unavailable") return "Unavailable for your date";
  if (state === "stale") return "Availability needs rechecking";
  return "Availability not checked";
}

function getBookingAvailabilityState(
  item: {
    availabilityDate: string | null;
    availabilityStatus: AvailabilityStatus;
  },
  weddingDate: string | null,
): PlanningHubAvailabilityState {
  if (!weddingDate) return "date_needed";
  const availability = getPlanningHubItemAvailability(item, weddingDate);
  return availability.stale ? "stale" : availability.status;
}
