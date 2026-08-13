import type { BudgetPlan } from "@/lib/budget/types";
import { getPlanningHubItemStageHref } from "@/lib/planning-hub/item-navigation";
import {
  getPhotographyNextHref,
  withPlanningWorkspace,
} from "@/lib/planning-hub/navigation";
import { getPlanningHubPaymentDeadlineHref } from "@/lib/planning-hub/payments";
import {
  createEmptyTablePlan,
  restoreTablePlan,
  serializeTablePlan,
} from "@/lib/table-plan/planner";
import type { TablePlan } from "@/lib/table-plan/types";
import type { WeddingProfile } from "./profile";
import {
  createWeddingProfile,
  restoreWeddingProfile,
} from "./profile";
import { profileVenueSearchHref } from "./profile-navigation";
import { getPlanningRecommendationDecision } from "./recommendations";
import type {
  PlanningRecommendation,
  PlanningRecommendationTarget,
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
  referenceDate = new Date(),
): PlanningRecommendation {
  const decision = getPlanningRecommendationDecision(
    budgetPlan,
    workspace,
    referenceDate,
  );
  return {
    stage: decision.stage,
    title: decision.title,
    reason: decision.reason,
    href: recommendationHref(
      decision.target,
      budgetPlan,
      workspace,
      workspaceId,
    ),
  };
}

function recommendationHref(
  target: PlanningRecommendationTarget,
  budgetPlan: BudgetPlan,
  workspace: PlanningWorkspace,
  workspaceId?: string | null,
) {
  switch (target.kind) {
    case "payment":
      return getPlanningHubPaymentDeadlineHref(
        budgetPlan,
        { itemId: target.itemId },
        workspaceId,
      );
    case "venue-search":
      return profileVenueSearchHref(
        workspace.profile,
        budgetPlan.totalBudgetPence,
        workspaceId,
      );
    case "photography-search":
      return getPhotographyNextHref(
        budgetPlan,
        workspace.profile.photographyStyles[0],
        workspaceId,
      );
    case "supplier-roadmap":
      return withPlanningWorkspace("/planning-hub/suppliers", workspaceId);
    case "plan-item": {
      const item = budgetPlan.items.find((candidate) => candidate.id === target.itemId);
      const stageHref = item
        ? getPlanningHubItemStageHref(item, workspaceId)
        : null;
      if (stageHref) return stageHref;
      return target.fallback === "venue-search"
        ? profileVenueSearchHref(
            workspace.profile,
            budgetPlan.totalBudgetPence,
            workspaceId,
          )
        : getPhotographyNextHref(
            budgetPlan,
            workspace.profile.photographyStyles[0],
            workspaceId,
          );
    }
    case "organise": {
      const hash = target.anchor ? `#${target.anchor}` : "";
      return withPlanningWorkspace(`/planning-hub/organise${hash}`, workspaceId);
    }
  }
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
