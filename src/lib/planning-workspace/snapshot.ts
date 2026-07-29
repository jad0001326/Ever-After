import { getPaymentDeadlines } from "@/lib/budget/calculations";
import type { BudgetPlan, CurrencyCode } from "@/lib/budget/types";
import { calculatePlanningHubPlan } from "@/lib/planning-hub/plan";
import { getTablePlanGuestOverview } from "@/lib/table-plan/guests";
import { profileCompletion } from "./profile";
import { getPlanningRecommendationDecision } from "./recommendations";
import { getPlanningTaskOverview } from "./tasks";
import type {
  PlanningRecommendationDecision,
  PlanningWorkspace,
} from "./types";

export type PlanningDashboardSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  workspace: {
    id: string;
    name: string;
    budgetPlanId: string;
  };
  wedding: {
    date: string | null;
    guestCount: number | null;
    location: string | null;
    currency: CurrencyCode;
    profileCompletionPercentage: number;
  };
  budget: ReturnType<typeof calculatePlanningHubPlan>;
  payments: {
    overdueCount: number;
    dueSoonCount: number;
    upcomingCount: number;
    next: ReturnType<typeof getPaymentDeadlines>[number] | null;
  };
  tasks: {
    openCount: number;
    overdueCount: number;
    dueTodayCount: number;
    dueSoonCount: number;
    nextTaskId: string | null;
  };
  guests: ReturnType<typeof getTablePlanGuestOverview>;
  recommendation: PlanningRecommendationDecision;
};

/**
 * Produces the platform-neutral dashboard contract consumed by presentation
 * adapters. The result intentionally contains only JSON-safe values: no URLs,
 * framework objects, Maps, Dates or persistence handles.
 */
export function createPlanningDashboardSnapshot(
  budgetPlan: BudgetPlan,
  workspace: PlanningWorkspace,
  referenceDate = new Date(),
): PlanningDashboardSnapshot {
  if (workspace.budgetPlanId !== budgetPlan.id) {
    throw new Error("Planning workspace and budget plan must refer to the same plan.");
  }

  const deadlines = getPaymentDeadlines(budgetPlan, referenceDate);
  const taskOverview = getPlanningTaskOverview(workspace.tasks, referenceDate);
  const completion = profileCompletion(workspace.profile);

  return {
    schemaVersion: 1,
    generatedAt: referenceDate.toISOString(),
    workspace: {
      id: workspace.id,
      name: workspace.name,
      budgetPlanId: budgetPlan.id,
    },
    wedding: {
      date: workspace.profile.weddingDate,
      guestCount: workspace.profile.guestCount,
      location: workspace.profile.location,
      currency: budgetPlan.currency,
      profileCompletionPercentage: completion.percentage,
    },
    budget: calculatePlanningHubPlan(budgetPlan),
    payments: {
      overdueCount: deadlines.filter(({ urgency }) => urgency === "overdue").length,
      dueSoonCount: deadlines.filter(({ urgency }) => urgency === "due_soon").length,
      upcomingCount: deadlines.filter(({ urgency }) => urgency === "upcoming").length,
      next: deadlines[0] ?? null,
    },
    tasks: {
      openCount: taskOverview.openCount,
      overdueCount: taskOverview.overdueCount,
      dueTodayCount: taskOverview.dueTodayCount,
      dueSoonCount: taskOverview.dueSoonCount,
      nextTaskId: taskOverview.tasks.find(({ urgency }) => urgency !== "done")
        ?.task.id ?? null,
    },
    guests: getTablePlanGuestOverview(
      workspace.tablePlan,
      workspace.profile.guestCount ?? 0,
    ),
    recommendation: getPlanningRecommendationDecision(
      budgetPlan,
      workspace,
      referenceDate,
    ),
  };
}
