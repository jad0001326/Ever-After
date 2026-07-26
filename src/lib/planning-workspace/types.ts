import type { TablePlan } from "@/lib/table-plan/types";

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
  ownerId: string | null;
  budgetPlanId: string;
  name: string;
  tasks: PlanningTask[];
  tablePlan: TablePlan;
  createdAt: string;
  updatedAt: string;
};

export type PlanningRecommendation =
  | { stage: "venue"; title: string; href: "/planning-hub"; reason: string }
  | { stage: "photography"; title: string; href: "/planning-hub/photography"; reason: string }
  | { stage: "guests"; title: string; href: "/planning-hub/organise"; reason: string }
  | { stage: "tables"; title: string; href: "/planning-hub/organise"; reason: string }
  | { stage: "tasks"; title: string; href: "/planning-hub/organise"; reason: string };
