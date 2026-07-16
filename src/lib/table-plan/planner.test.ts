import { describe, expect, it } from "vitest";
import { createExampleTablePlan, generateArrangement, planToCsv, restoreTablePlan, serializeTablePlan } from "./planner";

describe("table planner", () => {
  it("creates an arrangement that respects hard separation rules", () => {
    const source = createExampleTablePlan();
    const result = generateArrangement(source, 42);
    expect(result.conflicts).toEqual([]);
    const rule = source.rules.find((candidate) => candidate.type === "must_separate")!;
    const personA = result.plan.guests.find((guest) => guest.id === rule.personAId)!;
    const personB = result.plan.guests.find((guest) => guest.id === rule.personBId)!;
    expect(personA.tableId).not.toBe(personB.tableId);
    const counts = result.plan.tables.map((table) => result.plan.guests.filter((guest) => guest.tableId === table.id).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("reports when the plan does not have enough seats", () => {
    const source = createExampleTablePlan();
    source.tables = [{ ...source.tables[0], capacity: 4 }];
    const result = generateArrangement(source, 42);
    expect(result.conflicts[0]?.message).toContain("8 more seats");
  });

  it("round-trips local persistence", () => {
    const source = createExampleTablePlan();
    expect(restoreTablePlan(serializeTablePlan(source))).toEqual(source);
    expect(restoreTablePlan("not-json")).toBeNull();
  });

  it("exports an alphabetical CSV with table names", () => {
    const arranged = generateArrangement(createExampleTablePlan(), 42).plan;
    const csv = planToCsv(arranged);
    expect(csv).toContain('"Amy Fraser"');
    expect(csv.split("\r\n")[0]).toBe("Guest,Table,Seat");
  });
});
