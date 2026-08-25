import { formatMoney } from "@everaft/planning-domain/budget/calculations";
import { createPlanningDashboardSnapshot } from "@everaft/planning-domain/planning-workspace/snapshot";
import type { DevicePlanData } from "../../planning/device-plan-model";

export type TodayModel = {
  workspaceName: string;
  storageLabel: string;
  greeting: string;
  recommendation: { eyebrow: string; title: string; reason: string; actionLabel: string };
  budget: { total: string; remaining: string; committed: string; paid: string };
  comingUp: string;
};

export function createTodayModel(data: DevicePlanData, referenceDate = new Date()): TodayModel {
  const snapshot = createPlanningDashboardSnapshot(data.budgetPlan, data.workspace, referenceDate);

  return {
    workspaceName: snapshot.workspace.name,
    storageLabel: "On this device",
    greeting: "Good morning",
    recommendation: {
      eyebrow: "NEXT FOR YOUR DAY",
      title: snapshot.recommendation.stage === "venue" ? "Choose a venue" : snapshot.recommendation.title,
      reason: snapshot.recommendation.reason,
      actionLabel: snapshot.recommendation.stage === "venue" ? "Explore venues" : "Open next step",
    },
    budget: {
      total: formatMoney(snapshot.budget.totalBudgetPence),
      remaining: formatMoney(snapshot.budget.remainingPence),
      committed: formatMoney(snapshot.budget.committedPence),
      paid: formatMoney(snapshot.budget.paidPence),
    },
    comingUp: snapshot.payments.next ? snapshot.payments.next.label : "No deadlines yet",
  };
}
