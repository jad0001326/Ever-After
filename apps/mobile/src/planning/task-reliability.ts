import type { PlanningTaskResource } from "@everaft/api-client";
import { createPlanningId } from "@everaft/planning-domain/ids";
import type {
  PlanningTask,
  PlanningTaskCategory,
  PlanningTaskStatus,
} from "@everaft/planning-domain/planning-workspace/types";

export type TaskCreateInput = Readonly<{
  title: string;
  notes?: string | null;
  category?: PlanningTaskCategory;
  dueDate?: string | null;
}>;

export type TaskChanges = Partial<
  Pick<PlanningTask, "title" | "notes" | "category" | "status" | "dueDate" | "sortOrder">
>;

export function createDeviceTask(
  input: TaskCreateInput,
  existingTasks: PlanningTask[],
  now = new Date(),
): PlanningTask {
  const timestamp = now.toISOString();
  return {
    id: createPlanningId(),
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    category: input.category ?? "general",
    status: "todo",
    dueDate: input.dueDate ?? null,
    sortOrder: nextSortOrder(existingTasks),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateDeviceTask(
  task: PlanningTask,
  changes: TaskChanges,
  now = new Date(),
): PlanningTask {
  return {
    ...task,
    ...changes,
    ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
    ...(changes.notes !== undefined ? { notes: changes.notes?.trim() || null } : {}),
    updatedAt: now.toISOString(),
  };
}

export function taskResourceToDeviceTask(task: PlanningTaskResource): PlanningTask {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    category: task.category,
    status: task.status,
    dueDate: task.dueDate,
    sortOrder: task.sortOrder,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function taskToCreateContent(task: PlanningTask) {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    category: task.category,
    status: task.status,
    dueDate: task.dueDate,
    sortOrder: task.sortOrder,
  };
}

export function taskContentMatches(
  task: PlanningTaskResource,
  expected: PlanningTask,
) {
  return task.title === expected.title
    && task.notes === expected.notes
    && task.category === expected.category
    && task.status === expected.status
    && task.dueDate === expected.dueDate
    && task.sortOrder === expected.sortOrder;
}

export function replaceDeviceTask(
  tasks: PlanningTask[],
  replacement: PlanningTask,
) {
  const next = tasks.filter((task) => task.id !== replacement.id);
  next.push(replacement);
  return next.sort(compareTasks);
}

export function removeDeviceTask(tasks: PlanningTask[], taskId: string) {
  return tasks.filter((task) => task.id !== taskId);
}

export function nextTaskStatus(status: PlanningTaskStatus): PlanningTaskStatus {
  if (status === "todo") return "in_progress";
  if (status === "in_progress") return "done";
  return "todo";
}

function nextSortOrder(tasks: PlanningTask[]) {
  return tasks.reduce((maximum, task) => Math.max(maximum, task.sortOrder), -1) + 1;
}

function compareTasks(left: PlanningTask, right: PlanningTask) {
  return left.sortOrder - right.sortOrder
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id);
}
