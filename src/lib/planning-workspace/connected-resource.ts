import {
  planningConnectedPlanResourceSchema,
  type PlanningConnectedPlanResource,
} from "./connection-api-schema";
import type { loadPlanningWorkspaceContext } from "./server-snapshot";

type LoadedPlanningContext = Extract<
  Awaited<ReturnType<typeof loadPlanningWorkspaceContext>>,
  { ok: true }
>;

export function createPlanningConnectedPlanResource(
  loaded: LoadedPlanningContext,
): PlanningConnectedPlanResource {
  const { snapshot, budgetPlan } = loaded;
  const budgetPlanId = snapshot.workspace.budget_plan_id;
  if (!snapshot.profile || !budgetPlanId) {
    throw new Error("A connected workspace requires a complete wedding profile.");
  }

  return planningConnectedPlanResourceSchema.parse({
    schemaVersion: 1,
    workspace: {
      schemaVersion: 1,
      id: snapshot.workspace.id,
      name: snapshot.workspace.name,
      budgetPlanId,
      role: loaded.isOwner ? "owner" : "partner",
      createdAt: snapshot.workspace.created_at,
      updatedAt: snapshot.workspace.updated_at,
    },
    budgetPlan,
    profile: {
      schemaVersion: 1,
      weddingDate: snapshot.profile.wedding_date,
      guestCount: snapshot.profile.guest_count,
      location: snapshot.profile.location,
      dateFlexibility: snapshot.profile.date_flexibility,
      locationFlexible: snapshot.profile.location_flexible,
      priorities: snapshot.profile.priorities,
      venueStyles: snapshot.profile.venue_styles,
      photographyStyles: snapshot.profile.photography_styles,
      vision: snapshot.profile.vision,
      updatedAt: snapshot.profile.updated_at,
    },
    versions: {
      workspaceUpdatedAt: snapshot.workspace.updated_at,
      budgetUpdatedAt: budgetPlan.updatedAt,
      profileUpdatedAt: snapshot.profile.updated_at,
    },
  });
}
