import { describe, expect, it } from "vitest";
import {
  addManualPlanningHubVenue,
  createPlanningHubStarterPlan,
} from "@/lib/planning-hub/plan";
import { createEmptyTablePlan } from "@/lib/table-plan/planner";
import { createWeddingProfile } from "./profile";
import { getPlanningRecommendationDecision } from "./recommendations";
import type { PlanningWorkspace } from "./types";

describe("portable planning recommendations", () => {
  it("returns a venue decision without embedding a web route", () => {
    const decision = getPlanningRecommendationDecision(
      createPlanningHubStarterPlan(null),
      workspace(),
    );

    expect(decision).toMatchObject({
      stage: "venue",
      target: { kind: "venue-search" },
      title: "Choose the venue direction",
    });
    expect(decision).not.toHaveProperty("href");
  });

  it("moves from a booked venue to photography using a platform-neutral target", () => {
    const plan = addManualPlanningHubVenue(
      createPlanningHubStarterPlan(null),
      "Portable decision hall",
      500_000,
      "booked",
    );

    expect(getPlanningRecommendationDecision(plan, workspace())).toMatchObject({
      stage: "photography",
      target: { kind: "photography-search" },
      title: "Shortlist your photographer",
    });
  });

  it("identifies an overdue payment by stable plan-item ID", () => {
    const plan = addManualPlanningHubVenue(
      createPlanningHubStarterPlan(null),
      "Portable payment hall",
      500_000,
      "booked",
    );
    plan.items[0].installments = [{
      id: "portable-deposit",
      amountPence: 100_000,
      dueDate: "2027-05-01",
      kind: "deposit",
      label: "Booking deposit",
      paidAt: null,
      paidPence: 0,
    }];

    expect(getPlanningRecommendationDecision(
      plan,
      workspace(),
      new Date("2027-06-01T12:00:00Z"),
    )).toMatchObject({
      stage: "payments",
      target: {
        kind: "payment",
        itemId: plan.items[0].id,
      },
      title: "Review Portable payment hall payment",
    });
  });
});

function workspace(): PlanningWorkspace {
  return {
    schemaVersion: 1,
    id: "portable-workspace",
    cloudWorkspaceId: null,
    ownerId: null,
    budgetPlanId: "portable-budget",
    name: "Portable wedding plan",
    profile: createWeddingProfile(),
    tasks: [],
    tablePlan: createEmptyTablePlan(),
    createdAt: "2027-01-01T00:00:00.000Z",
    updatedAt: "2027-01-01T00:00:00.000Z",
  };
}
