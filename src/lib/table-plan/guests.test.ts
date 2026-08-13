import { describe, expect, it } from "vitest";
import { createEmptyTablePlan } from "./planner";
import { getTablePlanGuestOverview, isGuestForSeating } from "./guests";

describe("table-plan guests", () => {
  it("treats legacy guests without an RSVP as awaiting a reply", () => {
    const plan = createEmptyTablePlan();
    plan.guests = [{
      id: "legacy",
      name: "Legacy Guest",
      tableId: null,
      seatIndex: null,
    }];

    expect(getTablePlanGuestOverview(plan)).toMatchObject({
      totalCount: 1,
      pendingCount: 1,
      seatingGuestCount: 1,
      unassignedCount: 1,
    });
  });

  it("excludes declined guests from seating while retaining guest-list totals", () => {
    const plan = createEmptyTablePlan();
    plan.guests = [
      {
        id: "accepted",
        name: "Accepted Guest",
        rsvpStatus: "accepted",
        dietaryNotes: "Vegan",
        tableId: plan.tables[0].id,
        seatIndex: 0,
      },
      {
        id: "declined",
        name: "Declined Guest",
        rsvpStatus: "declined",
        tableId: null,
        seatIndex: null,
      },
    ];

    expect(isGuestForSeating(plan.guests[1])).toBe(false);
    expect(getTablePlanGuestOverview(plan, 4)).toEqual({
      totalCount: 2,
      acceptedCount: 1,
      pendingCount: 0,
      declinedCount: 1,
      dietaryCount: 1,
      seatingGuestCount: 1,
      assignedCount: 1,
      unassignedCount: 0,
      targetGap: 2,
    });
  });
});
