import { describe, expect, it } from "vitest";
import type { PlanningTask } from "./types";
import {
  formatPlanningTaskDate,
  getPlanningTaskCategoryLabel,
  getPlanningTaskOverview,
} from "./tasks";

function task(
  id: string,
  dueDate: string | null,
  status: PlanningTask["status"] = "todo",
  sortOrder = 0,
): PlanningTask {
  return {
    id,
    title: `Task ${id}`,
    notes: null,
    category: "general",
    status,
    dueDate,
    sortOrder,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
  };
}

describe("planning task schedule", () => {
  it("counts and orders active commitments by urgency before completed work", () => {
    const overview = getPlanningTaskOverview([
      task("unscheduled", null),
      task("future", "2026-09-01"),
      task("done", "2026-07-01", "done"),
      task("soon", "2026-08-10"),
      task("today", "2026-07-28"),
      task("overdue", "2026-07-20"),
    ], new Date("2026-07-28T12:00:00"));

    expect(overview).toMatchObject({
      openCount: 5,
      overdueCount: 1,
      dueTodayCount: 1,
      dueSoonCount: 1,
    });
    expect(overview.tasks.map(({ task: item, urgency }) => [item.id, urgency])).toEqual([
      ["overdue", "overdue"],
      ["today", "today"],
      ["soon", "due_soon"],
      ["future", "scheduled"],
      ["unscheduled", "unscheduled"],
      ["done", "done"],
    ]);
  });

  it("uses stable user-facing category and date labels", () => {
    expect(getPlanningTaskCategoryLabel("photography")).toBe("Photography");
    expect(formatPlanningTaskDate("2026-07-08")).toBe("8 Jul 2026");
  });
});
