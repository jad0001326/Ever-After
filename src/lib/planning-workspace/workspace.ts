import type { BudgetPlan } from "@/lib/budget/types";
import {
  createEmptyTablePlan,
  restoreTablePlan,
  serializeTablePlan,
} from "@/lib/table-plan/planner";
import type { TablePlan } from "@/lib/table-plan/types";
import type {
  PlanningRecommendation,
  PlanningTask,
  PlanningWorkspace,
} from "./types";

export const PLANNING_WORKSPACE_STORAGE_KEY = "everaft:planning-workspace:v1";

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyPlanningWorkspace({
  ownerId,
  budgetPlanId,
  tablePlan,
}: {
  ownerId: string | null;
  budgetPlanId: string;
  tablePlan?: TablePlan;
}): PlanningWorkspace {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: randomId(),
    ownerId,
    budgetPlanId,
    name: "Our wedding plan",
    tasks: [],
    tablePlan: tablePlan ?? createEmptyTablePlan(),
    createdAt: now,
    updatedAt: now,
  };
}

export function restorePlanningWorkspace(raw: string | null): PlanningWorkspace | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PlanningWorkspace>;
    if (
      parsed.schemaVersion !== 1
      || typeof parsed.id !== "string"
      || typeof parsed.budgetPlanId !== "string"
      || typeof parsed.name !== "string"
      || !Array.isArray(parsed.tasks)
      || !parsed.tablePlan
    ) return null;

    const tablePlan = restoreTablePlan(serializeTablePlan(parsed.tablePlan));
    if (!tablePlan || !parsed.tasks.every(isPlanningTask)) return null;
    return { ...parsed, tablePlan } as PlanningWorkspace;
  } catch {
    return null;
  }
}

export function serializePlanningWorkspace(workspace: PlanningWorkspace) {
  return JSON.stringify({ ...workspace, schemaVersion: 1 });
}

export function createPlanningTask(
  title: string,
  overrides: Partial<Pick<PlanningTask, "category" | "dueDate" | "notes" | "sortOrder">> = {},
): PlanningTask {
  const now = new Date().toISOString();
  return {
    id: randomId(),
    title: title.trim(),
    notes: overrides.notes ?? null,
    category: overrides.category ?? "general",
    status: "todo",
    dueDate: overrides.dueDate ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPlanningRecommendation(
  budgetPlan: BudgetPlan,
  workspace: PlanningWorkspace,
): PlanningRecommendation {
  const venue = budgetPlan.items.find((item) => item.categoryId === "venue" && item.bookingStatus !== "cancelled");
  if (!venue) {
    return {
      stage: "venue",
      title: "Choose the venue direction",
      href: "/planning-hub",
      reason: "Your venue anchors the date, location, capacity and the suppliers that fit.",
    };
  }

  const photography = budgetPlan.items.find((item) => item.categoryId === "photography" && item.bookingStatus !== "cancelled");
  if (!photography) {
    return {
      stage: "photography",
      title: "Shortlist your photographer",
      href: "/planning-hub/photography",
      reason: "Your venue is in the plan, so photography is the strongest next supplier decision.",
    };
  }

  if (workspace.tablePlan.guests.length === 0) {
    return {
      stage: "guests",
      title: "Start the guest list",
      href: "/planning-hub/organise",
      reason: "A working guest list makes capacity, catering and table decisions more reliable.",
    };
  }

  if (workspace.tablePlan.guests.some((guest) => !guest.tableId)) {
    return {
      stage: "tables",
      title: "Arrange your tables",
      href: "/planning-hub/organise",
      reason: "Some guests are still unassigned, so the table plan is ready for its next pass.",
    };
  }

  return {
    stage: "tasks",
    title: "Review the next open task",
    href: "/planning-hub/organise",
    reason: workspace.tasks.some((task) => task.status !== "done")
      ? "Your main planning stages are connected; keep momentum with the next unfinished task."
      : "Your current list is clear. Add the next commitment as plans develop.",
  };
}

function isPlanningTask(value: unknown): value is PlanningTask {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<PlanningTask>;
  return (
    typeof task.id === "string"
    && typeof task.title === "string"
    && ["venue", "photography", "budget", "guests", "tables", "general"].includes(task.category ?? "")
    && ["todo", "in_progress", "done"].includes(task.status ?? "")
    && (task.dueDate === null || typeof task.dueDate === "string")
    && typeof task.sortOrder === "number"
    && typeof task.createdAt === "string"
    && typeof task.updatedAt === "string"
  );
}
