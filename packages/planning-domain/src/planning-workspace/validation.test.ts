import { describe, expect, it } from "vitest";

import {
  planningWorkspaceImportSnapshotSchema,
} from "./validation";

const guestId = "80000000-0000-4000-8000-000000000008";
const tableId = "90000000-0000-4000-8000-000000000009";
const workspaceId = "60000000-0000-4000-8000-000000000006";

describe("table-plan RSVP seating validation", () => {
  it("rejects the same contradiction during atomic workspace import", () => {
    const result = planningWorkspaceImportSnapshotSchema.safeParse({
      id: workspaceId,
      budgetPlanId: "plan-1",
      name: "Our wedding",
      profile: {
        schemaVersion: 1,
        weddingDate: null,
        guestCount: 80,
        location: null,
        dateFlexibility: "not_set",
        locationFlexible: false,
        priorities: [],
        venueStyles: [],
        photographyStyles: [],
        vision: null,
        updatedAt: "2026-09-01T10:00:00.000Z",
      },
      tasks: [],
      guests: [{
        id: guestId,
        name: "Ailsa",
        email: null,
        rsvpStatus: "declined",
        dietaryNotes: null,
      }],
      tables: [{ id: tableId, name: "Top table", capacity: 8, locked: false }],
      seats: [{ guestId, tableId, seatIndex: 0 }],
      rules: [],
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected invalid workspace import.");
    expect(result.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: "A declined guest cannot retain a table seat." }),
    ]));
  });
});
