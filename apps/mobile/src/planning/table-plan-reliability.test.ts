import type { TablePlan } from "@everaft/planning-domain/table-plan/types";

import {
  normalizeTablePlanForSave,
  tablePlanContentMatches,
} from "./table-plan-reliability";

const plan: TablePlan = {
  schemaVersion: 1,
  id: "60000000-0000-4000-8000-000000000006",
  name: "Our wedding",
  guests: [{
    id: "80000000-0000-4000-8000-000000000008",
    name: "Ailsa",
    tableId: null,
    seatIndex: null,
  }],
  tables: [{
    id: "90000000-0000-4000-8000-000000000009",
    name: "Top table",
    capacity: 8,
    locked: false,
  }],
  rules: [],
  updatedAt: "2026-09-01T09:00:00.000Z",
};

describe("tablePlanContentMatches", () => {
  it("unseats declined guests without mutating a legacy readable plan", () => {
    const seatedDecline: TablePlan = {
      ...plan,
      guests: [{
        ...plan.guests[0],
        rsvpStatus: "declined",
        tableId: plan.tables[0].id,
        seatIndex: 0,
      }],
    };

    expect(normalizeTablePlanForSave(seatedDecline).guests[0]).toMatchObject({
      rsvpStatus: "declined",
      tableId: null,
      seatIndex: null,
    });
    expect(seatedDecline.guests[0]).toMatchObject({
      tableId: plan.tables[0].id,
      seatIndex: 0,
    });
  });

  it("ignores transport timestamps and normalises optional guest defaults", () => {
    expect(tablePlanContentMatches(plan, {
      ...plan,
      guests: [{
        ...plan.guests[0],
        email: null,
        rsvpStatus: "pending",
        dietaryNotes: null,
      }],
      updatedAt: "2026-09-01T10:00:00.000Z",
    })).toBe(true);
  });

  it("detects meaningful edits and array-order changes", () => {
    expect(tablePlanContentMatches(plan, {
      ...plan,
      guests: [{ ...plan.guests[0], name: "Ailsa Fraser" }],
    })).toBe(false);
    expect(tablePlanContentMatches({
      ...plan,
      tables: [
        ...plan.tables,
        { id: "91000000-0000-4000-8000-000000000009", name: "Table 2", capacity: 8, locked: false },
      ],
    }, {
      ...plan,
      tables: [
        { id: "91000000-0000-4000-8000-000000000009", name: "Table 2", capacity: 8, locked: false },
        ...plan.tables,
      ],
    })).toBe(false);
  });

  it("treats seating-rule order as transport-only", () => {
    const first = {
      id: "a0000000-0000-4000-8000-000000000001",
      personAId: "80000000-0000-4000-8000-000000000008",
      personBId: "81000000-0000-4000-8000-000000000008",
      type: "prefer_next_to" as const,
    };
    const second = {
      ...first,
      id: "b0000000-0000-4000-8000-000000000002",
      type: "must_separate" as const,
    };
    expect(tablePlanContentMatches(
      { ...plan, rules: [first, second] },
      { ...plan, rules: [second, first] },
    )).toBe(true);
  });
});
