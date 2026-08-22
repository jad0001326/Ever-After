import { formatMoney } from "@everaft/planning-domain/budget/calculations";
import { createWeddingProfile } from "@everaft/planning-domain/planning-workspace/profile";
import { createPlanningDashboardSnapshot } from "@everaft/planning-domain/planning-workspace/snapshot";
import type { PlanningWorkspace } from "@everaft/planning-domain/planning-workspace/types";
import { createPlanningHubStarterPlan } from "@everaft/planning-domain/planning-hub/plan";
import { createEmptyTablePlan } from "@everaft/planning-domain/table-plan/planner";

export type TodayModel = {
  workspaceName: string;
  storageLabel: string;
  greeting: string;
  recommendation: { eyebrow: string; title: string; reason: string; actionLabel: string };
  budget: { total: string; remaining: string; committed: string; paid: string };
  comingUp: string;
};

export function createSeededTodayModel(): TodayModel {
  const plan = createPlanningHubStarterPlan(null);
  const timestamp = "2026-08-20T09:00:00.000Z";
  const workspace: PlanningWorkspace = {
    schemaVersion: 1,
    id: "local-n2-workspace",
    cloudWorkspaceId: null,
    ownerId: null,
    budgetPlanId: plan.id,
    name: "My EverAft",
    profile: createWeddingProfile(plan),
    tasks: [],
    tablePlan: createEmptyTablePlan(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const snapshot = createPlanningDashboardSnapshot(plan, workspace, new Date(timestamp));

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
