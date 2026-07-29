import { describe, expect, it } from "vitest";
import {
  addManualPlanningHubVenue,
  createPlanningHubStarterPlan,
  updatePlanningHubItemInstallments,
} from "@/lib/planning-hub/plan";
import { createEmptyPlanningWorkspace } from "./workspace";
import { createPlanningDashboardSnapshot } from "./snapshot";
import {
  planningDashboardSnapshotJsonSchema,
  planningDashboardSnapshotSchema,
} from "./snapshot-schema";
import type { PlanningWorkspace } from "./types";
import checkedJsonSchema from "../../../docs/planning-hub/contracts/planning-dashboard-snapshot.v1.schema.json";

describe("createPlanningDashboardSnapshot", () => {
  it("returns one JSON-safe, platform-neutral dashboard contract", () => {
    const starter = {
      ...createPlanningHubStarterPlan(null),
      id: "budget-1",
      totalBudgetPence: 3_000_000,
      weddingDate: "2027-06-12",
      guestCount: 80,
      location: "Perthshire",
    };
    const withVenue = addManualPlanningHubVenue(
      starter,
      "Our local hall",
      500_000,
      "booked",
    );
    const venue = withVenue.items[0];
    const plan = updatePlanningHubItemInstallments(withVenue, venue.id, [{
      id: "deposit-1",
      kind: "deposit",
      label: "Venue deposit",
      amountPence: 100_000,
      paidPence: 50_000,
      dueDate: "2027-04-01",
      paidAt: null,
    }]);
    const emptyWorkspace = createEmptyPlanningWorkspace({
      ownerId: null,
      budgetPlanId: plan.id,
    });
    const workspace: PlanningWorkspace = {
      ...emptyWorkspace,
      profile: {
        ...emptyWorkspace.profile,
        weddingDate: plan.weddingDate,
        guestCount: plan.guestCount,
        location: plan.location,
        priorities: ["photography"],
      },
      tasks: [{
        id: "task-1",
        title: "Confirm ceremony time",
        notes: null,
        category: "venue" as const,
        status: "todo" as const,
        dueDate: "2027-05-10",
        sortOrder: 0,
        createdAt: "2027-01-01T00:00:00.000Z",
        updatedAt: "2027-01-01T00:00:00.000Z",
      }],
    };

    const snapshot = createPlanningDashboardSnapshot(
      plan,
      workspace,
      new Date("2027-05-01T12:00:00.000Z"),
    );
    const serialized = JSON.stringify(snapshot);

    expect(JSON.parse(serialized)).toEqual(snapshot);
    expect(planningDashboardSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(serialized).not.toContain("\"href\"");
    expect(serialized).not.toContain("\"url\"");
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2027-05-01T12:00:00.000Z",
      workspace: {
        budgetPlanId: "budget-1",
      },
      wedding: {
        date: "2027-06-12",
        guestCount: 80,
        location: "Perthshire",
        currency: "GBP",
      },
      budget: {
        totalBudgetPence: 3_000_000,
        committedPence: 500_000,
        remainingPence: 2_500_000,
        paidPence: 50_000,
      },
      payments: {
        overdueCount: 1,
        dueSoonCount: 0,
        upcomingCount: 0,
        next: {
          itemId: venue.id,
          installmentId: "deposit-1",
        },
      },
      tasks: {
        openCount: 1,
        nextTaskId: "task-1",
      },
      recommendation: {
        stage: "payments",
        target: {
          kind: "payment",
          itemId: venue.id,
        },
      },
    });
  });

  it("rejects a workspace joined to a different budget plan", () => {
    const plan = {
      ...createPlanningHubStarterPlan(null),
      id: "budget-1",
    };
    const workspace = createEmptyPlanningWorkspace({
      ownerId: null,
      budgetPlanId: "budget-2",
    });

    expect(() => createPlanningDashboardSnapshot(plan, workspace)).toThrow(
      "Planning workspace and budget plan must refer to the same plan.",
    );
  });

  it("rejects unknown web-adapter fields from the native contract", () => {
    const plan = {
      ...createPlanningHubStarterPlan(null),
      id: "budget-1",
    };
    const workspace = createEmptyPlanningWorkspace({
      ownerId: null,
      budgetPlanId: plan.id,
    });
    const snapshot = createPlanningDashboardSnapshot(plan, workspace);

    expect(planningDashboardSnapshotSchema.safeParse({
      ...snapshot,
      recommendation: {
        ...snapshot.recommendation,
        href: "/planning-hub",
      },
    }).success).toBe(false);
  });

  it("keeps the checked language-neutral JSON Schema in sync", () => {
    expect(checkedJsonSchema).toEqual(planningDashboardSnapshotJsonSchema);
    expect(checkedJsonSchema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "urn:everaft:planning-dashboard-snapshot:v1",
      title: "EverAft Planning Dashboard Snapshot v1",
      additionalProperties: false,
    });
  });
});
