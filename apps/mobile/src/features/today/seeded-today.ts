import { formatMoney } from "@everaft/planning-domain/budget/calculations";
import { createPlanningDashboardSnapshot } from "@everaft/planning-domain/planning-workspace/snapshot";
import {
  formatPlanningTaskDate,
  getPlanningTaskOverview,
} from "@everaft/planning-domain/planning-workspace/tasks";
import type { DevicePlanData } from "../../planning/device-plan-model";

export type TodayDestination =
  | Readonly<{ kind: "venues" }>
  | Readonly<{ kind: "photography" }>
  | Readonly<{ kind: "plan" }>
  | Readonly<{ kind: "guests" }>
  | Readonly<{ kind: "tables" }>
  | Readonly<{ kind: "payments"; itemId: string }>
  | Readonly<{ kind: "tasks" }>;

export type TodayModel = {
  workspaceName: string;
  storageLabel: string;
  greeting: string;
  recommendation: { eyebrow: string; title: string; reason: string; actionLabel: string; destination: TodayDestination };
  budget: { total: string; remaining: string; committed: string; paid: string };
  comingUp: readonly {
    kind: "payment" | "task";
    title: string;
    detail: string;
    actionLabel: string;
    destination: TodayDestination;
  }[];
};

export function createTodayModel(data: DevicePlanData, referenceDate = new Date()): TodayModel {
  const snapshot = createPlanningDashboardSnapshot(data.budgetPlan, data.workspace, referenceDate);
  const recommendationDestination = destinationForRecommendation(snapshot.recommendation);
  const payment = snapshot.payments.next;
  const task = getPlanningTaskOverview(data.workspace.tasks, referenceDate)
    .tasks.find(({ task: candidate, urgency }) => candidate.dueDate && urgency !== "done") ?? null;
  const comingUp: TodayModel["comingUp"] = [
    ...(payment ? [{
      kind: "payment" as const,
      title: `${payment.itemName}: ${payment.label}`,
      detail: `${urgencyLabel(payment.urgency)} · ${formatDate(payment.dueDate)} · ${payment.outstandingPence === null ? "Amount TBC" : `${formatMoney(payment.outstandingPence, data.budgetPlan.currency)} outstanding`}`,
      actionLabel: "Open payment",
      destination: { kind: "payments" as const, itemId: payment.itemId },
    }] : []),
    ...(task?.task.dueDate ? [{
      kind: "task" as const,
      title: task.task.title,
      detail: `${taskUrgencyLabel(task.urgency)} · ${formatPlanningTaskDate(task.task.dueDate)}`,
      actionLabel: "Open task",
      destination: { kind: "tasks" as const },
    }] : []),
  ];

  return {
    workspaceName: snapshot.workspace.name,
    storageLabel: "On this device",
    greeting: "Good morning",
    recommendation: {
      eyebrow: "NEXT FOR YOUR DAY",
      title: snapshot.recommendation.stage === "venue" ? "Choose a venue" : snapshot.recommendation.title,
      reason: snapshot.recommendation.reason,
      actionLabel: recommendationActionLabel(recommendationDestination),
      destination: recommendationDestination,
    },
    budget: {
      total: formatMoney(snapshot.budget.totalBudgetPence),
      remaining: formatMoney(snapshot.budget.remainingPence),
      committed: formatMoney(snapshot.budget.committedPence),
      paid: formatMoney(snapshot.budget.paidPence),
    },
    comingUp,
  };
}

function destinationForRecommendation(
  recommendation: ReturnType<typeof createPlanningDashboardSnapshot>["recommendation"],
): TodayDestination {
  if (recommendation.target.kind === "payment") {
    return { kind: "payments", itemId: recommendation.target.itemId };
  }
  if (recommendation.stage === "tasks") return { kind: "tasks" };
  if (recommendation.stage === "guests") return { kind: "guests" };
  if (recommendation.stage === "tables") return { kind: "tables" };
  if (recommendation.target.kind === "venue-search") return { kind: "venues" };
  if (recommendation.target.kind === "photography-search") return { kind: "photography" };
  return { kind: "plan" };
}

function recommendationActionLabel(destination: TodayDestination) {
  if (destination.kind === "venues") return "Explore venues";
  if (destination.kind === "photography") return "Explore photography";
  if (destination.kind === "payments") return "Review payment";
  if (destination.kind === "tasks") return "Review tasks";
  if (destination.kind === "guests") return "Review guests";
  if (destination.kind === "tables") return "Review tables";
  return "Open your plan";
}

function urgencyLabel(urgency: "overdue" | "due_soon" | "upcoming") {
  if (urgency === "overdue") return "Overdue";
  if (urgency === "due_soon") return "Due soon";
  return "Upcoming";
}

function taskUrgencyLabel(urgency: string) {
  if (urgency === "overdue") return "Overdue";
  if (urgency === "today") return "Due today";
  if (urgency === "due_soon") return "Due soon";
  return "Scheduled";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
