import { describe, expect, it } from "vitest";
import {
  createPlanningInviteSchema,
  planningGuestInputSchema,
  planningSeatInputSchema,
  planningSeatingRuleInputSchema,
  planningTaskInputSchema
} from "./validation";

const workspaceId = "60000000-0000-4000-8000-000000000006";
const firstGuestId = "80000000-0000-4000-8000-000000000008";
const secondGuestId = "b0000000-0000-4000-8000-00000000000b";
const tableId = "90000000-0000-4000-8000-000000000009";

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
});
