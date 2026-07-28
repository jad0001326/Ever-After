"use client";

import { Check, Circle, Clock3, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import {
  formatPlanningTaskDate,
  getPlanningTaskCategoryLabel,
  getPlanningTaskOverview,
} from "@/lib/planning-workspace/tasks";
import type {
  PlanningTask,
  PlanningTaskCategory,
  PlanningTaskStatus,
} from "@/lib/planning-workspace/types";

const taskCategories: PlanningTaskCategory[] = [
  "general",
  "venue",
  "photography",
  "budget",
  "guests",
  "tables",
];

export function PlanningHubTaskList({
  onAdd,
  onUpdate,
  onStatusChange,
  tasks,
  today,
}: {
  onAdd: (input: {
    title: string;
    category: PlanningTaskCategory;
    dueDate: string | null;
  }) => void;
  onUpdate: (
    taskId: string,
    input: {
      title: string;
      category: PlanningTaskCategory;
      dueDate: string | null;
    },
  ) => void;
  onStatusChange: (taskId: string, status: PlanningTaskStatus) => void;
  tasks: PlanningTask[];
  today: string;
}) {
  const overview = getPlanningTaskOverview(tasks, new Date(`${today}T12:00:00`));

  return (
    <section
      aria-labelledby="planning-tasks-title"
      className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6"
      id="planning-tasks"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#95502b]">Action list</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-[#173526]" id="planning-tasks-title">Your tasks</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-[#edf2ec] px-3 py-1 text-xs font-semibold text-[#31533b]">
            {overview.openCount} open
          </span>
          {overview.overdueCount > 0 ? (
            <span className="rounded-full bg-[#fff0eb] px-3 py-1 text-xs font-semibold text-[#9b3025]">
              {overview.overdueCount} overdue
            </span>
          ) : null}
        </div>
      </div>

      <NewTaskForm onAdd={onAdd} />

      <div className="mt-5 space-y-2">
        {overview.tasks.map(({ task, urgency }) => (
          <PlanningTaskRow
            key={task.id}
            onStatusChange={onStatusChange}
            onUpdate={onUpdate}
            task={task}
            urgency={urgency}
          />
        ))}
        {tasks.length === 0 ? (
          <p className="rounded-2xl bg-[#faf7f2] px-4 py-8 text-center text-sm text-[var(--muted)]">
            Add the first task that will move your plan forward.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function NewTaskForm({
  onAdd,
}: {
  onAdd: (input: {
    title: string;
    category: PlanningTaskCategory;
    dueDate: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PlanningTaskCategory>("general");
  const [dueDate, setDueDate] = useState("");

  function addTask() {
    if (!title.trim()) return;
    onAdd({
      title,
      category,
      dueDate: dueDate || null,
    });
    setTitle("");
    setCategory("general");
    setDueDate("");
  }

  return (
    <form
      className="mt-5 grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        addTask();
      }}
    >
      <label className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-semibold text-[#514b43]">Task</span>
        <input
          className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-sm"
          maxLength={240}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Confirm final venue numbers"
          required
          value={title}
        />
      </label>
      <label>
        <span className="mb-1.5 block text-xs font-semibold text-[#514b43]">Category</span>
        <select
          className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
          onChange={(event) => setCategory(event.target.value as PlanningTaskCategory)}
          value={category}
        >
          {taskCategories.map((value) => (
            <option key={value} value={value}>{getPlanningTaskCategoryLabel(value)}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1.5 block text-xs font-semibold text-[#514b43]">Due date <span className="font-normal text-[var(--muted)]">(optional)</span></span>
        <input
          className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-sm"
          onChange={(event) => setDueDate(event.target.value)}
          type="date"
          value={dueDate}
        />
      </label>
      <button
        className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173526] px-4 text-sm font-semibold text-white sm:col-span-2"
        type="submit"
      >
        <Plus size={18} />
        Add task
      </button>
    </form>
  );
}

type TaskUrgency = ReturnType<typeof getPlanningTaskOverview>["tasks"][number]["urgency"];

function PlanningTaskRow({
  onStatusChange,
  onUpdate,
  task,
  urgency,
}: {
  onStatusChange: (taskId: string, status: PlanningTaskStatus) => void;
  onUpdate: (
    taskId: string,
    input: {
      title: string;
      category: PlanningTaskCategory;
      dueDate: string | null;
    },
  ) => void;
  task: PlanningTask;
  urgency: TaskUrgency;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState(task.category);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");

  function beginEditing() {
    setTitle(task.title);
    setCategory(task.category);
    setDueDate(task.dueDate ?? "");
    setEditing(true);
  }

  function saveTask() {
    if (!title.trim()) return;
    onUpdate(task.id, {
      title,
      category,
      dueDate: dueDate || null,
    });
    setEditing(false);
  }

  return (
    <article
      className={`rounded-2xl border p-3 ${
        urgency === "overdue" ? "border-[#efb7aa] bg-[#fffaf8]" : "border-[#e5ddd1]"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          aria-label={task.status === "done" ? `Reopen ${task.title}` : `Complete ${task.title}`}
          className={`focus-ring grid size-11 shrink-0 place-items-center rounded-full ${
            task.status === "done" ? "bg-[#31533b] text-white" : "bg-[#f5efe6] text-[#7b6f60]"
          }`}
          onClick={() => onStatusChange(task.id, task.status === "done" ? "todo" : "done")}
          type="button"
        >
          {task.status === "done" ? <Check size={18} /> : <Circle size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${
            task.status === "done" ? "text-[#77716a] line-through" : "text-[#25221e]"
          }`}>{task.title}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {getPlanningTaskCategoryLabel(task.category)}
            {task.dueDate ? ` · ${formatPlanningTaskDate(task.dueDate)}` : " · No due date"}
          </p>
          <TaskUrgencyLabel urgency={urgency} />
        </div>
        <button
          aria-controls={`task-editor-${task.id}`}
          aria-expanded={editing}
          aria-label={`Edit ${task.title}`}
          className="focus-ring grid size-11 shrink-0 place-items-center rounded-full text-[#31533b] hover:bg-[#edf2ec]"
          onClick={() => editing ? setEditing(false) : beginEditing()}
          type="button"
        >
          <Pencil size={16} />
        </button>
        {task.status === "todo" ? (
            <button
              aria-label={`Start ${task.title}`}
              className="focus-ring grid size-11 shrink-0 place-items-center rounded-full text-[#95502b] hover:bg-[#fff2e8]"
            onClick={() => onStatusChange(task.id, "in_progress")}
            type="button"
          >
            <Clock3 size={17} />
          </button>
        ) : null}
      </div>
      {editing ? (
        <form
          aria-label={`Edit ${task.title}`}
          className="mt-3 grid gap-3 border-t border-[#e5ddd1] pt-3 sm:grid-cols-2"
          id={`task-editor-${task.id}`}
          onSubmit={(event) => {
            event.preventDefault();
            saveTask();
          }}
        >
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-[#514b43]">Edit task title</span>
            <input
              className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-sm"
              maxLength={240}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-[#514b43]">Edit category</span>
            <select
              className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
              onChange={(event) => setCategory(event.target.value as PlanningTaskCategory)}
              value={category}
            >
              {taskCategories.map((value) => (
                <option key={value} value={value}>{getPlanningTaskCategoryLabel(value)}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-[#514b43]">Edit due date</span>
            <input
              className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-sm"
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              className="focus-ring min-h-11 flex-1 rounded-xl bg-[#173526] px-4 text-sm font-semibold text-white"
              type="submit"
            >
              Save task
            </button>
            <button
              className="focus-ring min-h-11 rounded-xl border border-[var(--line)] px-4 text-sm font-semibold text-[#173526]"
              onClick={() => setEditing(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

function TaskUrgencyLabel({
  urgency,
}: {
  urgency: TaskUrgency;
}) {
  if (urgency === "overdue") {
    return <p className="mt-1 text-xs font-semibold text-[#9b3025]">Overdue</p>;
  }
  if (urgency === "today") {
    return <p className="mt-1 text-xs font-semibold text-[#95502b]">Due today</p>;
  }
  if (urgency === "due_soon") {
    return <p className="mt-1 text-xs font-semibold text-[#31533b]">Due in the next 30 days</p>;
  }
  if (urgency === "done") {
    return <p className="mt-1 text-xs font-semibold text-[#58705f]">Completed</p>;
  }
  return null;
}
