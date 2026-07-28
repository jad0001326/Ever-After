import type { BudgetPlan } from "@/lib/budget/types";
import { withPlanningWorkspace } from "@/lib/planning-hub/navigation";
import { getPhotographyNextHref } from "@/lib/planning-hub/plan";
import {
  createEmptyTablePlan,
  restoreTablePlan,
  serializeTablePlan,
} from "@/lib/table-plan/planner";
import type { TablePlan } from "@/lib/table-plan/types";
import {
  createWeddingProfile,
  profileVenueSearchHref,
  restoreWeddingProfile,
} from "./profile";
import type { WeddingProfile } from "./profile";
import type {
  PlanningRecommendation,
  PlanningTask,
  PlanningWorkspace,
} from "./types";

export const PLANNING_WORKSPACE_STORAGE_KEY = "everaft:planning-workspace:v1";
export function planningWorkspaceStorageKey(workspaceId?: string | null) {
  return workspaceId
    ? `${PLANNING_WORKSPACE_STORAGE_KEY}:workspace:${workspaceId}`
    : PLANNING_WORKSPACE_STORAGE_KEY;
}
export const PLANNING_WORKSPACE_BACKUP_STORAGE_KEY = "everaft:planning-workspace:backup:v1";

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyPlanningWorkspace({
  ownerId,
  budgetPlanId,
  tablePlan,
  profile,
}: {
  ownerId: string | null;
  budgetPlanId: string;
  tablePlan?: TablePlan;
  profile?: WeddingProfile;
}): PlanningWorkspace {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: randomId(),
    cloudWorkspaceId: null,
    ownerId,
    budgetPlanId,
    name: "Our wedding plan",
    profile: profile ?? createWeddingProfile(),
    tasks: [],
    tablePlan: tablePlan ?? createEmptyTablePlan(),
    createdAt: now,
    updatedAt: now,
  };
}

export function restorePlanningWorkspace(
  raw: string | null,
  fallbackProfile = createWeddingProfile(),
): PlanningWorkspace | null {
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
    return {
      ...parsed,
      cloudWorkspaceId: typeof parsed.cloudWorkspaceId === "string"
        ? parsed.cloudWorkspaceId
        : null,
      profile: restoreWeddingProfile(parsed.profile, fallbackProfile),
      tablePlan,
    } as PlanningWorkspace;
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
  workspaceId?: string | null,
): PlanningRecommendation {
  const venue = budgetPlan.items.find((item) => item.categoryId === "venue" && item.bookingStatus !== "cancelled");
  if (!venue) {
    return {
      stage: "venue",
      title: "Choose the venue direction",
      href: profileVenueSearchHref(workspace.profile, budgetPlan.totalBudgetPence, workspaceId),
      reason: workspace.profile.priorities.includes("venue")
        ? "You marked the venue as a priority. It anchors the date, location, capacity and suppliers that fit."
        : "Your venue anchors the date, location, capacity and the suppliers that fit.",
    };
  }

  const photography = budgetPlan.items.find((item) => item.categoryId === "photography" && item.bookingStatus !== "cancelled");
  if (!photography) {
    return {
      stage: "photography",
      title: "Shortlist your photographer",
      href: getPhotographyNextHref(budgetPlan, workspace.profile.photographyStyles[0], workspaceId),
      reason: workspace.profile.priorities.includes("photography")
        ? "Photography is one of your priorities, and your venue context can now shape the shortlist."
        : "Your venue is in the plan, so photography is the strongest next supplier decision.",
    };
  }

  if (workspace.tablePlan.guests.length === 0) {
    return {
      stage: "guests",
      title: "Start the guest list",
      href: withPlanningWorkspace("/planning-hub/organise", workspaceId),
      reason: "A working guest list makes capacity, catering and table decisions more reliable.",
    };
  }

  if (workspace.tablePlan.guests.some((guest) => !guest.tableId)) {
    return {
      stage: "tables",
      title: "Arrange your tables",
      href: withPlanningWorkspace("/planning-hub/organise", workspaceId),
      reason: "Some guests are still unassigned, so the table plan is ready for its next pass.",
    };
  }

  return {
    stage: "tasks",
    title: "Review the next open task",
    href: withPlanningWorkspace("/planning-hub/organise", workspaceId),
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
