import { describe, expect, it } from "vitest";

import type { TablePlan } from "./types";
import {
  addTablePlanGuest,
  addTablePlanGuests,
  parseTablePlanGuestNames,
  removeTablePlanGuest,
  searchTablePlanGuests,
  TablePlanGuestValidationError,
  updateTablePlanGuest,
} from "./guest-management";

const guestId = "80000000-0000-4000-8000-000000000008";
const secondGuestId = "81000000-0000-4000-8000-000000000008";
const now = new Date("2026-09-01T12:00:00.000Z");

describe("table-plan guest management", () => {
  it("adds one normalized guest with a stable caller-provided ID", () => {
    const next = addTablePlanGuest(emptyPlan(), {
      name: "  Ailsa Fraser  ",
      email: " AILSA@example.com ",
    }, { createId: () => guestId, now });

    expect(next.guests).toEqual([{
      id: guestId,
      name: "Ailsa Fraser",
      email: "ailsa@example.com",
      rsvpStatus: "pending",
      dietaryNotes: null,
      tableId: null,
      seatIndex: null,
    }]);
    expect(next.updatedAt).toBe(now.toISOString());
  });

  it("parses and bulk-adds newline, comma and semicolon separated names", () => {
    const names = parseTablePlanGuestNames("Ailsa Fraser\nBen Fraser, Chloe Martin;  ");
    const ids = [guestId, secondGuestId, "82000000-0000-4000-8000-000000000008"];
    const next = addTablePlanGuests(emptyPlan(), names, {
      createId: () => ids.shift()!,
      now,
    });

    expect(next.guests.map((guest) => guest.name)).toEqual([
      "Ailsa Fraser",
      "Ben Fraser",
      "Chloe Martin",
    ]);
    expect(new Set(next.guests.map((guest) => guest.id)).size).toBe(3);
  });

  it("edits all guest details and unseats a declined guest", () => {
    const plan = populatedPlan();
    const next = updateTablePlanGuest(plan, guestId, {
      name: "Ailsa Campbell",
      email: "AILSA.CAMPBELL@example.com",
      rsvpStatus: "declined",
      dietaryNotes: "  Nut allergy  ",
    }, now);

    expect(next.guests[0]).toMatchObject({
      name: "Ailsa Campbell",
      email: "ailsa.campbell@example.com",
      rsvpStatus: "declined",
      dietaryNotes: "Nut allergy",
      tableId: null,
      seatIndex: null,
    });
  });

  it("deletes dependent seating rules with the guest", () => {
    const next = removeTablePlanGuest(populatedPlan(), guestId, now);
    expect(next.guests.map((guest) => guest.id)).toEqual([secondGuestId]);
    expect(next.rules).toEqual([]);
  });

  it("searches names and emails without changing the stored order", () => {
    const plan = populatedPlan();
    expect(searchTablePlanGuests(plan.guests, "ailsa").map((guest) => guest.id)).toEqual([guestId]);
    expect(searchTablePlanGuests(plan.guests, "ben@example").map((guest) => guest.id)).toEqual([secondGuestId]);
    expect(plan.guests.map((guest) => guest.id)).toEqual([guestId, secondGuestId]);
  });

  it("rejects invalid contact data and an oversized guest list", () => {
    expect(() => addTablePlanGuest(emptyPlan(), {
      name: "Ailsa",
      email: "not-an-email",
    })).toThrow(TablePlanGuestValidationError);
    expect(() => addTablePlanGuests({
      ...emptyPlan(),
      guests: Array.from({ length: 1000 }, (_, index) => ({
        id: `guest-${index}`,
        name: `Guest ${index}`,
        tableId: null,
        seatIndex: null,
      })),
    }, ["One more"])).toThrow(/up to 1,000 guests/);
  });
});

function emptyPlan(): TablePlan {
  return {
    schemaVersion: 1,
    id: "60000000-0000-4000-8000-000000000006",
    name: "Our wedding",
    guests: [],
    tables: [{
      id: "90000000-0000-4000-8000-000000000009",
      name: "Top table",
      capacity: 8,
      locked: false,
    }],
    rules: [],
    updatedAt: "2026-09-01T10:00:00.000Z",
  };
}

function populatedPlan(): TablePlan {
  const base = emptyPlan();
  return {
    ...base,
    guests: [{
      id: guestId,
      name: "Ailsa Fraser",
      email: "ailsa@example.com",
      rsvpStatus: "accepted",
      dietaryNotes: null,
      tableId: base.tables[0].id,
      seatIndex: 0,
    }, {
      id: secondGuestId,
      name: "Ben Fraser",
      email: "ben@example.com",
      rsvpStatus: "pending",
      dietaryNotes: null,
      tableId: null,
      seatIndex: null,
    }],
    rules: [{
      id: "a0000000-0000-4000-8000-000000000001",
      personAId: guestId,
      personBId: secondGuestId,
      type: "prefer_next_to",
    }],
  };
}
