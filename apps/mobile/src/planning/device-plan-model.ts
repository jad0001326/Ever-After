import { createPlanningId } from "@everaft/planning-domain/ids";
import { createPlanningHubStarterPlan } from "@everaft/planning-domain/planning-hub/plan";
import {
  createWeddingProfile,
  type WeddingPriority,
} from "@everaft/planning-domain/planning-workspace/profile";
import type { PlanningWorkspace } from "@everaft/planning-domain/planning-workspace/types";
import { createEmptyTablePlan } from "@everaft/planning-domain/table-plan/planner";
import type { BudgetPlan } from "@everaft/planning-domain/budget/types";
import type { CatalogueSupplier, CatalogueVenue } from "@everaft/api-client";

export type DevicePlanData = Readonly<{
  format: "everaft-device-plan";
  formatVersion: 3;
  localPreferences: Readonly<{ weddingSeason: string | null }>;
  discovery: Readonly<{
    comparedVenues: CatalogueVenue[];
    savedVenueIds: string[];
    comparedSuppliers: CatalogueSupplier[];
    savedSupplierIds: string[];
  }>;
  budgetPlan: BudgetPlan;
  workspace: PlanningWorkspace;
}>;

export type DevicePlanSetup = Readonly<{
  weddingDate: string | null;
  location: string | null;
  guestCount: number | null;
  totalBudgetPence: number;
  priorities: WeddingPriority[];
  weddingSeason: string | null;
}>;

export function createDevicePlan(
  setup: DevicePlanSetup,
  now = new Date(),
): DevicePlanData {
  const timestamp = now.toISOString();
  const budgetPlan: BudgetPlan = {
    ...createPlanningHubStarterPlan(null),
    totalBudgetPence: setup.totalBudgetPence,
    weddingDate: setup.weddingDate,
    guestCount: setup.guestCount,
    location: setup.location,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const profile = {
    ...createWeddingProfile(budgetPlan),
    dateFlexibility: setup.weddingSeason ? "season_only" as const : budgetPlan.weddingDate ? "fixed" as const : "not_set" as const,
    priorities: [...setup.priorities],
    updatedAt: timestamp,
  };
  const workspace: PlanningWorkspace = {
    schemaVersion: 1,
    id: createPlanningId(),
    cloudWorkspaceId: null,
    ownerId: null,
    budgetPlanId: budgetPlan.id,
    name: "My EverAft",
    profile,
    tasks: [],
    tablePlan: createEmptyTablePlan(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    format: "everaft-device-plan",
    formatVersion: 3,
    localPreferences: { weddingSeason: setup.weddingSeason },
    discovery: { comparedVenues: [], savedVenueIds: [], comparedSuppliers: [], savedSupplierIds: [] },
    budgetPlan,
    workspace,
  };
}

export function updateDevicePlan(
  data: DevicePlanData,
  update: (current: DevicePlanData) => DevicePlanData,
  now = new Date(),
) {
  const next = update(data);
  const timestamp = now.toISOString();
  return {
    ...next,
    budgetPlan: { ...next.budgetPlan, updatedAt: timestamp },
    workspace: { ...next.workspace, updatedAt: timestamp },
  } satisfies DevicePlanData;
}
