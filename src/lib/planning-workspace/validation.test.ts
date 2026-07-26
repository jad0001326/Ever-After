import { describe, expect, it } from "vitest";
import {
  createPlanningInviteSchema,
  importPlanningWorkspaceSchema,
  planningGuestInputSchema,
  planningSeatInputSchema,
  planningSeatingRuleInputSchema,
  planningTaskInputSchema,
  planningWorkspaceImportSnapshotSchema
} from "./validation";

const workspaceId = "60000000-0000-4000-8000-000000000006";
const firstGuestId = "80000000-0000-4000-8000-000000000008";
const secondGuestId = "b0000000-0000-4000-8000-00000000000b";
const tableId = "90000000-0000-4000-8000-000000000009";
const validImportSnapshot = {
  id: workspaceId,
  budgetPlanId: "budget-1",
  name: "Our wedding plan",
  profile: {
    schemaVersion: 1 as const,
    weddingDate: "2027-06-12",
    guestCount: 90,
    location: "Perthshire",
    dateFlexibility: "fixed" as const,
    locationFlexible: false,
    priorities: ["venue", "guest_experience"] as const,
    venueStyles: ["Castle"],
    photographyStyles: ["Documentary"],
    vision: "A relaxed weekend with everyone together.",
    updatedAt: "2026-07-26T10:00:00.000Z"
  },
  tasks: [],
  guests: [{
    id: firstGuestId,
    name: "Ailsa Grant",
    email: null,
    rsvpStatus: "pending" as const,
    dietaryNotes: null
  }],
  tables: [{
    id: tableId,
    name: "Top table",
    capacity: 8,
    locked: false
  }],
  seats: [{
    guestId: firstGuestId,
    tableId,
    seatIndex: 0
  }],
  rules: []
};

describe("planning workspace cloud validation", () => {
  it("normalizes invitation and optional guest email addresses", () => {
    expect(createPlanningInviteSchema.parse({
      workspaceId,
      email: "  PARTNER@Example.com "
    }).email).toBe("partner@example.com");

    expect(planningGuestInputSchema.parse({
      workspaceId,
      name: "Ailsa Grant",
      email: "  AILSA@example.com "
    }).email).toBe("ailsa@example.com");

    expect(planningGuestInputSchema.parse({
      workspaceId,
      name: "No email",
      email: " "
    }).email).toBeNull();
  });

  it("rejects oversized private notes and invalid task dates", () => {
    expect(planningGuestInputSchema.safeParse({
      workspaceId,
      name: "Ailsa Grant",
      dietaryNotes: "x".repeat(2001)
    }).success).toBe(false);

    expect(planningTaskInputSchema.safeParse({
      workspaceId,
      title: "Confirm numbers",
      dueDate: "26/07/2026"
    }).success).toBe(false);
  });

  it("keeps seat positions inside the table capacity boundary", () => {
    expect(planningSeatInputSchema.safeParse({
      workspaceId,
      guestId: firstGuestId,
      tableId,
      seatIndex: 19
    }).success).toBe(true);

    expect(planningSeatInputSchema.safeParse({
      workspaceId,
      guestId: firstGuestId,
      tableId,
      seatIndex: 20
    }).success).toBe(false);
  });

  it("requires seating rules to reference two different guests", () => {
    expect(planningSeatingRuleInputSchema.safeParse({
      workspaceId,
      personAId: firstGuestId,
      personBId: firstGuestId,
      ruleType: "must_separate"
    }).success).toBe(false);

    expect(planningSeatingRuleInputSchema.safeParse({
      workspaceId,
      personAId: firstGuestId,
      personBId: secondGuestId,
      ruleType: "must_separate"
    }).success).toBe(true);
  });

  it("accepts a bounded import snapshot with consistent guest and seat references", () => {
    expect(planningWorkspaceImportSnapshotSchema.safeParse(validImportSnapshot).success).toBe(true);
    expect(importPlanningWorkspaceSchema.safeParse({
      snapshot: validImportSnapshot,
      targetWorkspaceId: workspaceId,
      expectedUpdatedAt: "2026-07-26T10:00:00.000Z"
    }).success).toBe(true);
  });

  it("rejects destructive imports without a cloud version token", () => {
    expect(importPlanningWorkspaceSchema.safeParse({
      snapshot: validImportSnapshot,
      targetWorkspaceId: workspaceId,
      expectedUpdatedAt: null
    }).success).toBe(false);
  });

  it("rejects duplicate or out-of-capacity seating before contacting Supabase", () => {
    expect(planningWorkspaceImportSnapshotSchema.safeParse({
      ...validImportSnapshot,
      seats: [
        { guestId: firstGuestId, tableId, seatIndex: 8 },
        { guestId: firstGuestId, tableId, seatIndex: 0 }
      ]
    }).success).toBe(false);
  });

  it("rejects duplicate or unsupported private profile preferences", () => {
    expect(planningWorkspaceImportSnapshotSchema.safeParse({
      ...validImportSnapshot,
      profile: {
        ...validImportSnapshot.profile,
        priorities: ["venue", "not-a-priority"]
      }
    }).success).toBe(false);

    expect(planningWorkspaceImportSnapshotSchema.safeParse({
      ...validImportSnapshot,
      profile: {
        ...validImportSnapshot.profile,
        venueStyles: ["Castle", "Castle"]
      }
    }).success).toBe(false);
  });
});
