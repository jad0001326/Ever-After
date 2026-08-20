import { getPaymentDeadlines } from "../budget/calculations";
import type { BudgetPlan } from "../budget/types";
import {
  getPlanningHubItemAvailability,
  hasPlannedNonPhotographySupplier,
} from "../planning-hub/plan";
import { getTablePlanGuestOverview } from "../table-plan/guests";
import {
  formatPlanningTaskDate,
  getPlanningTaskCategoryLabel,
  getPlanningTaskOverview,
} from "./tasks";
import type {
  PlanningRecommendationDecision,
  PlanningWorkspace,
} from "./types";

export function getPlanningRecommendationDecision(
  budgetPlan: BudgetPlan,
  workspace: PlanningWorkspace,
  referenceDate = new Date(),
): PlanningRecommendationDecision {
  const overduePayment = getPaymentDeadlines(budgetPlan, referenceDate)
    .find((deadline) => deadline.urgency === "overdue");
  if (overduePayment) {
    return {
      stage: "payments",
      title: `Review ${overduePayment.itemName} payment`,
      target: { kind: "payment", itemId: overduePayment.itemId },
      reason: `${overduePayment.label} is overdue. Update the payment or its deadline before the next planning step.`,
    };
  }

  const overdueTask = getPlanningTaskOverview(workspace.tasks, referenceDate)
    .tasks.find(({ urgency }) => urgency === "overdue")?.task;
  if (overdueTask?.dueDate) {
    return {
      stage: "tasks",
      title: `Review ${overdueTask.title}`,
      target: { kind: "organise", anchor: "planning-tasks-title" },
      reason: `${getPlanningTaskCategoryLabel(overdueTask.category)} task due ${formatPlanningTaskDate(overdueTask.dueDate)}. Complete it or update the plan before moving on.`,
    };
  }

  const venue = budgetPlan.items.find((item) => (
    item.categoryId === "venue" && item.bookingStatus !== "cancelled"
  ));
  if (!venue) {
    return {
      stage: "venue",
      title: "Choose the venue direction",
      target: { kind: "venue-search" },
      reason: workspace.profile.priorities.includes("venue")
        ? "You marked the venue as a priority. It anchors the date, location, capacity and suppliers that fit."
        : "Your venue anchors the date, location, capacity and the suppliers that fit.",
    };
  }

  const selectedVenue = budgetPlan.items.find((item) => (
    item.categoryId === "venue"
    && item.bookingStatus !== "cancelled"
    && (
      item.id === budgetPlan.selectedVenueId
      || item.listingId === budgetPlan.selectedVenueId
    )
  ));
  const venueAvailability = selectedVenue
    ? availabilityRecommendation(selectedVenue, budgetPlan.weddingDate)
    : null;
  if (selectedVenue && venueAvailability && selectedVenue.bookingStatus !== "booked") {
    return {
      stage: "venue",
      title: venueAvailability.title,
      target: {
        kind: "plan-item",
        itemId: selectedVenue.id,
        fallback: "venue-search",
      },
      reason: venueAvailability.reason,
    };
  }

  const photography = budgetPlan.items.find((item) => (
    item.categoryId === "photography" && item.bookingStatus !== "cancelled"
  ));
  if (!photography) {
    return {
      stage: "photography",
      title: "Shortlist your photographer",
      target: { kind: "photography-search" },
      reason: workspace.profile.priorities.includes("photography")
        ? "Photography is one of your priorities, and your venue context can now shape the shortlist."
        : "Your venue is in the plan, so photography is the strongest next supplier decision.",
    };
  }

  const photographyAvailability = availabilityRecommendation(
    photography,
    budgetPlan.weddingDate,
  );
  if (photographyAvailability && photography.bookingStatus !== "booked") {
    return {
      stage: "photography",
      title: photographyAvailability.title,
      target: {
        kind: "plan-item",
        itemId: photography.id,
        fallback: "photography-search",
      },
      reason: photographyAvailability.reason,
    };
  }

  if (!hasPlannedNonPhotographySupplier(budgetPlan)) {
    return {
      stage: "suppliers",
      title: "Plan your next suppliers",
      target: { kind: "supplier-roadmap" },
      reason: "Choose the supplier category that matters next. Live catalogues can be browsed, and businesses found elsewhere can still be added manually.",
    };
  }

  const guestOverview = getTablePlanGuestOverview(
    workspace.tablePlan,
    workspace.profile.guestCount ?? 0,
  );
  if (guestOverview.totalCount === 0) {
    return {
      stage: "guests",
      title: "Start the guest list",
      target: { kind: "organise", anchor: "guest-readiness-title" },
      reason: "A working guest list makes capacity, catering and table decisions more reliable.",
    };
  }
  if (guestOverview.pendingCount > 0) {
    return {
      stage: "guests",
      title: `Confirm ${guestOverview.pendingCount} outstanding ${guestOverview.pendingCount === 1 ? "RSVP" : "RSVPs"}`,
      target: { kind: "organise", anchor: "guest-readiness-title" },
      reason: "Record who is attending before finalising catering numbers and table assignments.",
    };
  }
  if (guestOverview.seatingGuestCount === 0) {
    return {
      stage: "guests",
      title: "Add attending guests",
      target: { kind: "organise", anchor: "guest-readiness-title" },
      reason: "Everyone currently listed is marked as not attending, so there is no seating plan to arrange yet.",
    };
  }
  if (guestOverview.unassignedCount > 0) {
    return {
      stage: "tables",
      title: "Arrange your tables",
      target: { kind: "organise", anchor: "guest-readiness-title" },
      reason: `${guestOverview.unassignedCount} attending ${guestOverview.unassignedCount === 1 ? "guest is" : "guests are"} still unassigned, so the table plan is ready for its next pass.`,
    };
  }

  return {
    stage: "tasks",
    title: "Review the next open task",
    target: { kind: "organise", anchor: null },
    reason: workspace.tasks.some((task) => task.status !== "done")
      ? "Your main planning stages are connected; keep momentum with the next unfinished task."
      : "Your current list is clear. Add the next commitment as plans develop.",
  };
}

function availabilityRecommendation(
  item: BudgetPlan["items"][number],
  weddingDate: string | null,
) {
  if (!weddingDate) return null;
  const availability = getPlanningHubItemAvailability(item, weddingDate);
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${weddingDate}T12:00:00Z`));
  if (availability.stale) {
    return {
      title: `Recheck ${item.itemName} availability`,
      reason: `Your wedding date changed. Confirm ${item.itemName} again for ${date} before relying on the earlier response.`,
    };
  }
  if (availability.status === "not_checked") {
    return {
      title: `Check ${item.itemName} availability`,
      reason: `EverAft does not infer supplier calendars. Confirm ${date} directly before treating this option as suitable.`,
    };
  }
  if (availability.status === "enquiry_sent") {
    return {
      title: `Follow up with ${item.itemName}`,
      reason: `Your availability enquiry for ${date} is still awaiting a response.`,
    };
  }
  if (availability.status === "unavailable") {
    return {
      title: `Replace ${item.itemName}`,
      reason: `${item.itemName} is recorded as unavailable on ${date}. Return to this stage and choose another option.`,
    };
  }
  return null;
}
