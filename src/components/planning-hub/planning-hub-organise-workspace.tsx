"use client";

import { CalendarCheck2, Check, Circle, Clock3, LockKeyhole, Plus, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PlanningHubProfile } from "@/components/planning-hub/planning-hub-profile";
import { PlanningWorkspaceCloudImport } from "@/components/planning-hub/planning-workspace-cloud-import";
import {
  BUDGET_STORAGE_KEY,
  restoreBudgetPlan,
  serializeBudgetPlan,
} from "@/lib/budget/persistence";
import type { BudgetPlan } from "@/lib/budget/types";
import {
  resolvePlanningWorkspaceStartup,
} from "@/lib/planning-workspace/cloud";
import type {
  PlanningWorkspaceCloudSnapshot,
  PlanningWorkspaceStartupMode,
} from "@/lib/planning-workspace/cloud";
import { createWeddingProfile } from "@/lib/planning-workspace/profile";
import type { WeddingProfile } from "@/lib/planning-workspace/profile";
import {
  createEmptyPlanningWorkspace,
  createPlanningTask,
  getPlanningRecommendation,
  PLANNING_WORKSPACE_STORAGE_KEY,
  restorePlanningWorkspace,
  serializePlanningWorkspace,
} from "@/lib/planning-workspace/workspace";
import type { PlanningTaskStatus, PlanningWorkspace } from "@/lib/planning-workspace/types";
import { restoreTablePlan, TABLE_PLAN_STORAGE_KEY } from "@/lib/table-plan/planner";
import type { TablePlan } from "@/lib/table-plan/types";

const EmbeddedTablePlanner = dynamic(
  () => import("@/components/table-plan/table-planner").then((module) => module.TablePlanner),
  { ssr: false, loading: () => <div aria-busy="true" className="h-80 animate-pulse rounded-3xl bg-[#e7dfd2]"><span className="sr-only">Opening the guest and table planner.</span></div> },
);

export function PlanningHubOrganiseWorkspace({
  cloudEnabled = false,
  initialBudgetPlan,
  initialCloudSnapshot = null,
  userId,
}: {
  cloudEnabled?: boolean;
  initialBudgetPlan: BudgetPlan;
  initialCloudSnapshot?: PlanningWorkspaceCloudSnapshot | null;
  userId: string | null;
}) {
  const [budgetPlan, setBudgetPlan] = useState(initialBudgetPlan);
  const [workspace, setWorkspace] = useState<PlanningWorkspace | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<PlanningWorkspaceStartupMode>("device_only");
  const [ready, setReady] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [tablePlannerOpen, setTablePlannerOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const localBudgetPlan = restoreBudgetPlan(readLocalStorage(BUDGET_STORAGE_KEY));
      const activeBudgetPlan = localBudgetPlan
        && Date.parse(localBudgetPlan.updatedAt) > Date.parse(initialBudgetPlan.updatedAt)
        ? { ...localBudgetPlan, userId }
        : initialBudgetPlan;
      const compatibleCloudSnapshot =
        initialCloudSnapshot?.workspace.budget_plan_id === activeBudgetPlan.id
          ? initialCloudSnapshot
          : null;
      const fallbackProfile = createWeddingProfile(activeBudgetPlan);
      const restored = restorePlanningWorkspace(
        readLocalStorage(PLANNING_WORKSPACE_STORAGE_KEY),
        fallbackProfile,
      );
      const legacyTablePlan = restoreTablePlan(readLocalStorage(TABLE_PLAN_STORAGE_KEY));
      const deviceWorkspace = restored?.budgetPlanId === activeBudgetPlan.id
        ? restored
        : createEmptyPlanningWorkspace({
          ownerId: userId,
          budgetPlanId: activeBudgetPlan.id,
          profile: fallbackProfile,
          tablePlan: legacyTablePlan ?? undefined,
        });
      const startup = resolvePlanningWorkspaceStartup({
        cloudEnabled,
        cloudSnapshot: compatibleCloudSnapshot,
        deviceWorkspace,
        ownerId: userId,
        budgetPlanId: activeBudgetPlan.id,
      });
      setBudgetPlan(activeBudgetPlan);
      setWorkspace(startup.workspace);
      setWorkspaceMode(startup.mode);
      setReady(true);
    });
  }, [cloudEnabled, initialBudgetPlan, initialCloudSnapshot, userId]);

  useEffect(() => {
    if (!ready || !workspace) return;
    writeLocalStorage(PLANNING_WORKSPACE_STORAGE_KEY, serializePlanningWorkspace(workspace));
    writeLocalStorage(BUDGET_STORAGE_KEY, serializeBudgetPlan(budgetPlan));
  }, [budgetPlan, ready, workspace]);

  const updateTablePlan = useCallback((tablePlan: TablePlan) => {
    setWorkspaceMode((current) => current === "cloud_loaded" ? "device_ahead" : current);
    setWorkspace((current) => current
      ? { ...current, tablePlan, updatedAt: new Date().toISOString() }
      : current);
  }, []);

  function resolveCloudWorkspace(resolvedWorkspace: PlanningWorkspace) {
    setBudgetPlan((current) => ({
      ...current,
      weddingDate: resolvedWorkspace.profile.weddingDate,
      guestCount: resolvedWorkspace.profile.guestCount,
      location: resolvedWorkspace.profile.location,
      updatedAt: resolvedWorkspace.profile.updatedAt,
    }));
    setWorkspace(resolvedWorkspace);
    setWorkspaceMode("cloud_loaded");
  }

  const openTasks = useMemo(
    () => workspace?.tasks.filter((task) => task.status !== "done").length ?? 0,
    [workspace?.tasks],
  );
  const activeCloudSnapshot =
    initialCloudSnapshot?.workspace.budget_plan_id === budgetPlan.id
      ? initialCloudSnapshot
      : null;

  if (!ready || !workspace) {
    return <div aria-busy="true" className="h-96 animate-pulse rounded-3xl bg-[#e7dfd2]"><span className="sr-only">Preparing your organised plan.</span></div>;
  }

  const recommendation = getPlanningRecommendation(budgetPlan, workspace);
  const assignedGuests = workspace.tablePlan.guests.filter((guest) => guest.tableId).length;

  function saveProfile(profile: WeddingProfile, totalBudgetPence: number) {
    const now = profile.updatedAt;
    setWorkspaceMode((current) => current === "cloud_loaded" ? "device_ahead" : current);
    setBudgetPlan((current) => ({
      ...current,
      totalBudgetPence,
      weddingDate: profile.weddingDate,
      guestCount: profile.guestCount,
      location: profile.location,
      updatedAt: now,
    }));
    setWorkspace((current) => current ? {
      ...current,
      profile,
      updatedAt: now,
    } : current);
  }

  function addTask() {
    if (!taskTitle.trim()) return;
    setWorkspaceMode((current) => current === "cloud_loaded" ? "device_ahead" : current);
    setWorkspace((current) => current ? {
      ...current,
      tasks: [...current.tasks, createPlanningTask(taskTitle, { sortOrder: current.tasks.length })],
      updatedAt: new Date().toISOString(),
    } : current);
    setTaskTitle("");
  }

  function setTaskStatus(taskId: string, status: PlanningTaskStatus) {
    const now = new Date().toISOString();
    setWorkspaceMode((current) => current === "cloud_loaded" ? "device_ahead" : current);
    setWorkspace((current) => current ? {
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, status, updatedAt: now } : task),
      updatedAt: now,
    } : current);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3" aria-label="Planning overview">
        <SummaryCard icon={<CalendarCheck2 size={19} />} label="Open tasks" value={String(openTasks)} />
        <SummaryCard icon={<UsersRound size={19} />} label="Guests" value={String(workspace.tablePlan.guests.length)} />
        <SummaryCard icon={<Check size={19} />} label="Seats assigned" value={`${assignedGuests}/${workspace.tablePlan.guests.length}`} />
      </section>

      <PlanningHubProfile
        onSave={saveProfile}
        profile={workspace.profile}
        totalBudgetPence={budgetPlan.totalBudgetPence}
      />

      <section className="rounded-3xl border border-[#d8c7a7] bg-[#fff9ef] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#95502b]">Recommended next</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#173526]">{recommendation.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625f57]">{recommendation.reason}</p>
          </div>
          <Link className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#173526] px-5 text-sm font-semibold text-white" href={recommendation.href}>
            Continue planning
          </Link>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#95502b]">Action list</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-[#173526]">Your tasks</h2>
            </div>
            <span className="rounded-full bg-[#edf2ec] px-3 py-1 text-xs font-semibold text-[#31533b]">{openTasks} open</span>
          </div>
          <div className="mt-5 flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">New task</span>
              <input
                className="focus-ring min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-sm"
                onChange={(event) => setTaskTitle(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") addTask(); }}
                placeholder="e.g. Confirm final venue numbers"
                value={taskTitle}
              />
            </label>
            <button aria-label="Add task" className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl bg-[#173526] text-white" onClick={addTask} type="button">
              <Plus size={18} />
            </button>
          </div>
          <div className="mt-5 space-y-2">
            {workspace.tasks.map((task) => (
              <article className="flex items-center gap-3 rounded-2xl border border-[#e5ddd1] p-3" key={task.id}>
                <button
                  aria-label={task.status === "done" ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  className={`focus-ring grid size-10 shrink-0 place-items-center rounded-full ${task.status === "done" ? "bg-[#31533b] text-white" : "bg-[#f5efe6] text-[#7b6f60]"}`}
                  onClick={() => setTaskStatus(task.id, task.status === "done" ? "todo" : "done")}
                  type="button"
                >
                  {task.status === "done" ? <Check size={18} /> : <Circle size={18} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${task.status === "done" ? "text-[#77716a] line-through" : "text-[#25221e]"}`}>{task.title}</p>
                  <p className="mt-1 text-xs capitalize text-[var(--muted)]">{task.category} · {task.status.replace("_", " ")}</p>
                </div>
                {task.status === "todo" ? (
                  <button aria-label={`Start ${task.title}`} className="focus-ring grid size-10 shrink-0 place-items-center rounded-full text-[#95502b] hover:bg-[#fff2e8]" onClick={() => setTaskStatus(task.id, "in_progress")} type="button">
                    <Clock3 size={17} />
                  </button>
                ) : null}
              </article>
            ))}
            {workspace.tasks.length === 0 ? <p className="rounded-2xl bg-[#faf7f2] px-4 py-8 text-center text-sm text-[var(--muted)]">Add the first task that will move your plan forward.</p> : null}
          </div>
        </section>

        <aside className="rounded-3xl border border-[#d8c7a7] bg-[#f9f5ed] p-5 sm:p-6">
          <span className="grid size-11 place-items-center rounded-full bg-[#173526] text-white"><LockKeyhole size={19} /></span>
          <h2 className="mt-4 font-display text-2xl font-semibold text-[#173526]">Partner access</h2>
          <p className="mt-2 text-sm leading-6 text-[#625f57]">Secure partner sharing is the next release gate. It will use signed-in membership and row-level access, never a public editable link.</p>
          <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs leading-5 text-[#625f57]">
            {partnerAccessMessage({ cloudEnabled, userId, workspaceMode })}
          </p>
          <PlanningWorkspaceCloudImport
            budgetPlan={budgetPlan}
            cloudEnabled={cloudEnabled}
            cloudSnapshot={activeCloudSnapshot}
            mode={workspaceMode}
            onWorkspaceResolved={resolveCloudWorkspace}
            userId={userId}
            workspace={workspace}
          />
        </aside>
      </div>

      {tablePlannerOpen ? (
        <section className="rounded-3xl border border-[var(--line)] bg-[#fbfaf7] p-3 sm:p-5">
          <div className="mb-2 flex justify-end print:hidden">
            <button className="focus-ring min-h-10 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[#173526]" onClick={() => setTablePlannerOpen(false)} type="button">Close table editor</button>
          </div>
          <EmbeddedTablePlanner initialPlan={workspace.tablePlan} mode="embedded" onPlanChange={updateTablePlan} storageKey={null} />
        </section>
      ) : (
        <section className="rounded-3xl border border-[var(--line)] bg-[#fbfaf7] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#95502b]">Guest and table workspace</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-[#173526]">Open the table editor when you need it</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625f57]">
                {workspace.tablePlan.guests.length} guests, {workspace.tablePlan.tables.length} tables and {assignedGuests} assigned seats are ready. The full seating canvas stays unloaded until you open it.
              </p>
            </div>
            <button className="focus-ring min-h-11 shrink-0 rounded-full bg-[#173526] px-5 text-sm font-semibold text-white" onClick={() => setTablePlannerOpen(true)} type="button">Open guest &amp; table planner</button>
          </div>
        </section>
      )}
      <p className="text-center text-xs leading-5 text-[#58705f]" role="status">
        {workspaceStatusMessage(workspaceMode, cloudEnabled)}
      </p>
    </div>
  );
}

function partnerAccessMessage({
  cloudEnabled,
  userId,
  workspaceMode,
}: {
  cloudEnabled: boolean;
  userId: string | null;
  workspaceMode: PlanningWorkspaceStartupMode;
}) {
  if (!userId) {
    return "Sign in before cloud sharing becomes available. This version remains saved on this device.";
  }
  if (!cloudEnabled) {
    return "This workspace is linked to your current budget plan on this device. Cloud sharing stays off until the reviewed security migration can be verified for free.";
  }
  if (workspaceMode === "review_required") {
    return "A separate cloud copy was found. Your device plan was kept and will not be overwritten without a deliberate review.";
  }
  if (workspaceMode === "device_only") {
    return "Secure cloud connection is available for review, but this device plan has not been uploaded.";
  }
  return "Your latest edits remain on this device until you explicitly review the cloud update.";
}

function workspaceStatusMessage(
  workspaceMode: PlanningWorkspaceStartupMode,
  cloudEnabled: boolean,
) {
  if (workspaceMode === "cloud_loaded") {
    return "A secure cloud copy was loaded. New edits are also kept on this device while write-through remains in private testing.";
  }
  if (workspaceMode === "device_ahead") {
    return "Your latest edits are safe on this device. They have not overwritten the older cloud copy.";
  }
  if (workspaceMode === "review_required") {
    return "Your device copy was kept because it differs from the available cloud workspace. Nothing was overwritten.";
  }
  if (cloudEnabled) {
    return "This plan is saved on this device. Use the review step before creating a secure cloud copy.";
  }
  return "Tasks, guests and tables are saved together on this device. No database migration or partner access has been enabled.";
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-5">
      <span className="grid size-10 place-items-center rounded-full bg-[#edf2ec] text-[#31533b]">{icon}</span>
      <p className="mt-4 text-3xl font-semibold text-[#173526]">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{label}</p>
    </div>
  );
}

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The in-memory workspace remains usable if browser storage is unavailable.
  }
}
