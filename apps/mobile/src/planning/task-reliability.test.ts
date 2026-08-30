import {
  createDeviceTask,
  nextTaskStatus,
  replaceDeviceTask,
  taskContentMatches,
  taskResourceToDeviceTask,
  updateDeviceTask,
} from "./task-reliability";

const task = {
  id: "70000000-0000-4000-8000-000000000007",
  title: "Confirm guest numbers",
  notes: null,
  category: "guests" as const,
  status: "todo" as const,
  dueDate: "2027-07-01",
  sortOrder: 2,
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
};

describe("native task reliability", () => {
  it("creates stable local content before a connected write", () => {
    const created = createDeviceTask(
      { title: "  Book transport  ", notes: "  Ask venue  " },
      [task],
      new Date("2026-08-30T11:00:00.000Z"),
    );

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created).toMatchObject({
      title: "Book transport",
      notes: "Ask venue",
      category: "general",
      status: "todo",
      sortOrder: 3,
    });
  });

  it("compares canonical content without depending on server timestamps", () => {
    const resource = { schemaVersion: 1 as const, workspaceId: "60000000-0000-4000-8000-000000000006", ...task };
    expect(taskContentMatches(resource, task)).toBe(true);
    expect(taskContentMatches({ ...resource, title: "Different" }, task)).toBe(false);
    expect(taskResourceToDeviceTask(resource)).toEqual(task);
  });

  it("updates and replaces one task deterministically", () => {
    const updated = updateDeviceTask(task, { status: "done" }, new Date("2026-08-30T12:00:00.000Z"));
    expect(updated).toMatchObject({ status: "done", updatedAt: "2026-08-30T12:00:00.000Z" });
    expect(replaceDeviceTask([task], updated)).toEqual([updated]);
    expect(["in_progress", "done", "todo"]).toEqual([
      nextTaskStatus("todo"), nextTaskStatus("in_progress"), nextTaskStatus("done"),
    ]);
  });
});
