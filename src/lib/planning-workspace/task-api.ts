import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PlanningTask } from "./types";

type PlanningSupabaseClient = SupabaseClient<Database>;
type PlanningTaskRow = Database["public"]["Tables"]["planning_tasks"]["Row"];
type PlanningTaskCreate = Pick<
  PlanningTask,
  "title" | "notes" | "category" | "status" | "dueDate" | "sortOrder"
> & { id?: string };
type PlanningTaskChanges = Partial<
  Pick<
    PlanningTask,
    "title" | "notes" | "category" | "status" | "dueDate" | "sortOrder"
  >
>;

const taskColumns =
  "id, workspace_id, title, notes, category, status, due_date, sort_order, created_at, updated_at";

export async function listPlanningTasks(
  supabase: PlanningSupabaseClient,
  workspaceId: string,
  offset: number,
  limit: number,
) {
  const { data, error } = await supabase
    .from("planning_tasks")
    .select(taskColumns)
    .eq("workspace_id", workspaceId)
    .order("sort_order")
    .order("created_at")
    .range(offset, offset + limit);
  if (error) return { ok: false, reason: "unavailable" } as const;
  const rows = data ?? [];
  return {
    ok: true,
    tasks: rows.slice(0, limit).map(taskFromRow),
    hasMore: rows.length > limit,
  } as const;
}

export async function loadPlanningTask(
  supabase: PlanningSupabaseClient,
  workspaceId: string,
  taskId: string,
) {
  const { data, error } = await supabase
    .from("planning_tasks")
    .select(taskColumns)
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .maybeSingle();
  if (error) return { ok: false, reason: "unavailable" } as const;
  return {
    ok: true,
    task: data ? taskFromRow(data) : null,
  } as const;
}

export async function createPlanningTask(
  supabase: PlanningSupabaseClient,
  workspaceId: string,
  task: PlanningTaskCreate,
) {
  const { data, error } = await supabase
    .from("planning_tasks")
    .insert({
      ...(task.id ? { id: task.id } : {}),
      workspace_id: workspaceId,
      title: task.title,
      notes: task.notes,
      category: task.category,
      status: task.status,
      due_date: task.dueDate,
      sort_order: task.sortOrder,
    })
    .select(taskColumns)
    .single();
  if (error?.code === "23505") {
    return { ok: false, reason: "version_conflict" } as const;
  }
  if (error || !data) return { ok: false, reason: "unavailable" } as const;
  return { ok: true, task: taskFromRow(data) } as const;
}

export async function updatePlanningTask(
  supabase: PlanningSupabaseClient,
  workspaceId: string,
  taskId: string,
  changes: PlanningTaskChanges,
  expectedTaskUpdatedAt: string,
) {
  const { data, error } = await supabase
    .from("planning_tasks")
    .update(taskToColumns(changes))
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .eq("updated_at", expectedTaskUpdatedAt)
    .select(taskColumns)
    .maybeSingle();
  if (error) return { ok: false, reason: "unavailable" } as const;
  if (!data) return { ok: false, reason: "version_conflict" } as const;
  return { ok: true, task: taskFromRow(data) } as const;
}

export async function deletePlanningTask(
  supabase: PlanningSupabaseClient,
  workspaceId: string,
  taskId: string,
  expectedTaskUpdatedAt: string,
) {
  const { data, error } = await supabase
    .from("planning_tasks")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .eq("updated_at", expectedTaskUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, reason: "unavailable" } as const;
  if (!data) return { ok: false, reason: "version_conflict" } as const;
  return { ok: true, taskId: data.id } as const;
}

function taskToColumns(task: PlanningTaskChanges) {
  return {
    ...(task.title !== undefined ? { title: task.title } : {}),
    ...(task.notes !== undefined ? { notes: task.notes } : {}),
    ...(task.category !== undefined ? { category: task.category } : {}),
    ...(task.status !== undefined ? { status: task.status } : {}),
    ...(task.dueDate !== undefined ? { due_date: task.dueDate } : {}),
    ...(task.sortOrder !== undefined ? { sort_order: task.sortOrder } : {}),
  };
}

function taskFromRow(row: PlanningTaskRow) {
  return {
    schemaVersion: 1 as const,
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    notes: row.notes,
    category: row.category,
    status: row.status,
    dueDate: row.due_date,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
