import type {
  PlanningTask,
  PlanningTaskCategory,
} from "./types";

export type PlanningTaskUrgency =
  | "overdue"
  | "today"
  | "due_soon"
  | "scheduled"
  | "unscheduled"
  | "done";

export type PlanningTaskWithUrgency = {
  task: PlanningTask;
  urgency: PlanningTaskUrgency;
};

export type PlanningTaskOverview = {
  tasks: PlanningTaskWithUrgency[];
  openCount: number;
  overdueCount: number;
  dueTodayCount: number;
  dueSoonCount: number;
};

const categoryLabels: Record<PlanningTaskCategory, string> = {
  venue: "Venue",
  photography: "Photography",
  budget: "Budget",
  guests: "Guests",
  tables: "Tables",
  general: "General",
};

const urgencyRank: Record<PlanningTaskUrgency, number> = {
  overdue: 0,
  today: 1,
  due_soon: 2,
  scheduled: 3,
  unscheduled: 4,
  done: 5,
};

export function getPlanningTaskCategoryLabel(category: PlanningTaskCategory) {
  return categoryLabels[category];
}

export function getPlanningTaskOverview(
  tasks: PlanningTask[],
  referenceDate: Date,
): PlanningTaskOverview {
  const today = dateKey(referenceDate);
  let openCount = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;
  let dueSoonCount = 0;

  const scheduled = tasks.map((task) => {
    const urgency = getPlanningTaskUrgency(task, today);
    if (urgency !== "done") openCount += 1;
    if (urgency === "overdue") overdueCount += 1;
    if (urgency === "today") dueTodayCount += 1;
    if (urgency === "due_soon") dueSoonCount += 1;
    return { task, urgency };
  });

  scheduled.sort((left, right) => {
    const urgencyDifference = urgencyRank[left.urgency] - urgencyRank[right.urgency];
    if (urgencyDifference !== 0) return urgencyDifference;
    const leftDate = left.task.dueDate ?? "9999-12-31";
    const rightDate = right.task.dueDate ?? "9999-12-31";
    const dueDateDifference = leftDate.localeCompare(rightDate);
    if (dueDateDifference !== 0) return dueDateDifference;
    return left.task.sortOrder - right.task.sortOrder;
  });

  return {
    tasks: scheduled,
    openCount,
    overdueCount,
    dueTodayCount,
    dueSoonCount,
  };
}

export function formatPlanningTaskDate(dueDate: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dueDate}T12:00:00Z`));
}

function getPlanningTaskUrgency(
  task: PlanningTask,
  today: string,
): PlanningTaskUrgency {
  if (task.status === "done") return "done";
  if (!task.dueDate) return "unscheduled";
  const difference = daysBetween(today, task.dueDate);
  if (difference < 0) return "overdue";
  if (difference === 0) return "today";
  if (difference <= 30) return "due_soon";
  return "scheduled";
}

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(from: string, to: string) {
  const fromTime = Date.parse(`${from}T12:00:00Z`);
  const toTime = Date.parse(`${to}T12:00:00Z`);
  return Math.round((toTime - fromTime) / 86_400_000);
}
