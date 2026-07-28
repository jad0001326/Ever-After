import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlanningTask } from "@/lib/planning-workspace/types";
import { PlanningHubTaskList } from "./planning-hub-task-list";

function task(overrides: Partial<PlanningTask> = {}): PlanningTask {
  return {
    id: "task-1",
    title: "Confirm guest numbers",
    notes: null,
    category: "guests",
    status: "todo",
    dueDate: "2026-07-20",
    sortOrder: 0,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("PlanningHubTaskList", () => {
  it("captures a category and optional due date when adding a task", () => {
    const onAdd = vi.fn();
    render(
      <PlanningHubTaskList
        onAdd={onAdd}
        onStatusChange={vi.fn()}
        onUpdate={vi.fn()}
        tasks={[]}
        today="2026-07-28"
      />,
    );

    fireEvent.change(screen.getByLabelText("Task"), { target: { value: "Confirm flowers" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "general" } });
    fireEvent.change(screen.getByLabelText(/Due date/), { target: { value: "2026-08-12" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(onAdd).toHaveBeenCalledWith({
      title: "Confirm flowers",
      category: "general",
      dueDate: "2026-08-12",
    });
  });

  it("surfaces overdue work and retains accessible status controls", () => {
    const onStatusChange = vi.fn();
    const onUpdate = vi.fn();
    render(
      <PlanningHubTaskList
        onAdd={vi.fn()}
        onStatusChange={onStatusChange}
        onUpdate={onUpdate}
        tasks={[task()]}
        today="2026-07-28"
      />,
    );

    expect(screen.getByText("1 overdue")).toBeTruthy();
    expect(screen.getByText(/20 Jul 2026/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Complete Confirm guest numbers" }));
    expect(onStatusChange).toHaveBeenCalledWith("task-1", "done");

    fireEvent.click(screen.getByRole("button", { name: "Edit Confirm guest numbers" }));
    fireEvent.change(screen.getByLabelText("Edit task title"), {
      target: { value: "Confirm final guest numbers" },
    });
    fireEvent.change(screen.getByLabelText("Edit due date"), {
      target: { value: "2026-08-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(onUpdate).toHaveBeenCalledWith("task-1", {
      title: "Confirm final guest numbers",
      category: "guests",
      dueDate: "2026-08-02",
    });
  });
});
