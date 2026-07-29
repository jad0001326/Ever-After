import type { TablePlan } from "@/lib/table-plan/types";
import type { WeddingProfile } from "./profile";

export type PlanningTaskStatus = "todo" | "in_progress" | "done";
export type PlanningTaskCategory = "venue" | "photography" | "budget" | "guests" | "tables" | "general";

export type PlanningTask = {
  id: string;
  title: string;
  notes: string | null;
  category: PlanningTaskCategory;
  status: PlanningTaskStatus;
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PlanningWorkspace = {
  schemaVersion: 1;
  id: string;
  cloudWorkspaceId: string | null;
  ownerId: string | null;
  budgetPlanId: string;
  name: string;
  profile: WeddingProfile;
  tasks: PlanningTask[];
  tablePlan: TablePlan;
  createdAt: string;
  updatedAt: string;
};

export type PlanningRecommendationStage =
  | "payments"
  | "venue"
  | "photography"
  | "suppliers"
  | "guests"
  | "tables"
  | "tasks";

export type PlanningRecommendationTarget =
  | { kind: "payment"; itemId: string }
  | { kind: "venue-search" }
  | { kind: "photography-search" }
  | { kind: "supplier-roadmap" }
  | {
      kind: "plan-item";
      itemId: string;
      fallback: "venue-search" | "photography-search";
    }
  | {
      kind: "organise";
      anchor: "planning-tasks-title" | "guest-readiness-title" | null;
    };

type PlanningRecommendationContent = {
  stage: PlanningRecommendationStage;
  title: string;
  reason: string;
};

export type PlanningRecommendationDecision = PlanningRecommendationContent & {
  target: PlanningRecommendationTarget;
};

export type PlanningRecommendation = PlanningRecommendationContent & {
  href: string;
};
