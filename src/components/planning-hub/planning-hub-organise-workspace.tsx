"use client";

import { CalendarCheck2, Check, LockKeyhole, UsersRound } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { PlanningHubBookingOverview } from "@/components/planning-hub/planning-hub-booking-overview";
import { PlanningHubGuestOverview } from "@/components/planning-hub/planning-hub-guest-overview";
import { PlanningHubProfile } from "@/components/planning-hub/planning-hub-profile";
import { PlanningHubPaymentOverview } from "@/components/planning-hub/planning-hub-payment-overview";
import { PlanningHubTaskList } from "@/components/planning-hub/planning-hub-task-list";
import { PlanningPartnerAccess } from "@/components/planning-hub/planning-partner-access";
import { PlanningWorkspaceCloudImport } from "@/components/planning-hub/planning-workspace-cloud-import";
import {
  planningHubBudgetStorageKey,
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
  planningWorkspaceStorageKey,
  restorePlanningWorkspace,
  serializePlanningWorkspace,
} from "@/lib/planning-workspace/workspace";
import { getPlanningTaskOverview } from "@/lib/planning-workspace/tasks";
import { getTablePlanGuestOverview } from "@/lib/table-plan/guests";
import type {
  PlanningTaskCategory,
  PlanningTaskStatus,
  PlanningWorkspace,
} from "@/lib/planning-workspace/types";
import { restoreTablePlan, serializeTablePlan, TABLE_PLAN_STORAGE_KEY } from "@/lib/table-plan/planner";
import type { TablePlan } from "@/lib/table-plan/types";

const EmbeddedTablePlanner = dynamic(
  () => import("@/components/table-plan/table-planner").then((module) => module.TablePlanner),
  { ssr: false, loading: () => <div aria-busy="true" className="h-80 animate-pulse rounded-3xl bg-[#e7dfd2]"><span className="sr-only">Opening the guest and table planner.</span></div> },
);

export function PlanningHubOrganiseWorkspace({
  cloudEnabled = false,
  connectedWorkspaceId = null,
  initialBudgetPlan,
  initialCloudSnapshot = null,
  today = "2026-07-28",
  userId,
}: {
  cloudEnabled?: boolean;
  connectedWorkspaceId?: string | null;
  initialBudgetPlan: BudgetPlan;
  initialCloudSnapshot?: PlanningWorkspaceCloudSnapshot | null;
  today?: string;
  userId: string | null;
}) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(connectedWorkspaceId);
  const budgetStorageKey = planningHubBudgetStorageKey(activeWorkspaceId);
  const workspaceStorageKey = planningWorkspaceStorageKey(activeWorkspaceId);
  const [budgetPlan, setBudgetPlan] = useState(initialBudgetPlan);
  const [workspace, setWorkspace] = useState<PlanningWorkspace | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<PlanningWorkspaceStartupMode>("device_only");
  const [cloudSnapshot, setCloudSnapshot] = useState(initialCloudSnapshot);
  const cloudVersionRef = useRef(initialCloudSnapshot?.workspace.updated_at ?? null);
  const lastTablePlanRef = useRef<string | null>(null);
  const tableSyncTimerRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [tablePlannerOpen, setTablePlannerOpen] = useState(false);
  const [, startCloudTransition] = useTransition();

  useEffect(() => {
    queueMicrotask(() => {
      const localBudgetPlan = restoreBudgetPlan(readLocalStorage(budgetStorageKey));
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
        readLocalStorage(workspaceStorageKey),
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
      lastTablePlanRef.current = serializeTablePlan(startup.workspace.tablePlan);
      setWorkspaceMode(startup.mode);
      setReady(true);
    });
  }, [budgetStorageKey, cloudEnabled, initialBudgetPlan, initialCloudSnapshot, userId, workspaceStorageKey]);

  useEffect(() => {
    if (!ready || !workspace) return;
    writeLocalStorage(workspaceStorageKey, serializePlanningWorkspace(workspace));
    writeLocalStorage(budgetStorageKey, serializeBudgetPlan(budgetPlan));
  }, [budgetPlan, budgetStorageKey, ready, workspace, workspaceStorageKey]);

  useEffect(() => () => {
    if (tableSyncTimerRef.current !== null) {
      window.clearTimeout(tableSyncTimerRef.current);
    }
  }, []);

  const updateTablePlan = useCallback((tablePlan: TablePlan) => {
    const serializedTablePlan = serializeTablePlan(tablePlan);
    if (lastTablePlanRef.current === serializedTablePlan) return;
    lastTablePlanRef.current = serializedTablePlan;
    setWorkspaceMode((current) => current === "cloud_loaded" ? "device_ahead" : current);
    setWorkspace((current) => current
      ? { ...current, tablePlan, updatedAt: new Date().toISOString() }
      : current);
    if (activeWorkspaceId && cloudVersionRef.current) {
      if (tableSyncTimerRef.current !== null) {
        window.clearTimeout(tableSyncTimerRef.current);
      }
      setSyncFeedback("Guest and table changes are safe on this device and waiting to sync…");
      tableSyncTimerRef.current = window.setTimeout(() => {
        const expectedUpdatedAt = cloudVersionRef.current;
        if (!expectedUpdatedAt) return;
        startCloudTransition(async () => {
          const { syncPlanningTablePlanAction } = await import("@/app/actions/planning-workspace");
          const result = await syncPlanningTablePlanAction(
            activeWorkspaceId,
            tablePlan,
            expectedUpdatedAt,
          );
          if (!result.ok) {
            setSyncFeedback(result.message);
            return;
          }
          cloudVersionRef.current = result.updatedAt;
          setCloudSnapshot((current) => current ? {
            ...current,
            workspace: { ...current.workspace, updated_at: result.updatedAt },
            guests: tablePlan.guests.map((guest, index) => ({
              id: guest.id,
              workspace_id: activeWorkspaceId,
              name: guest.name,
              email: guest.email ?? null,
              rsvp_status: guest.rsvpStatus ?? "pending",
              dietary_notes: guest.dietaryNotes ?? null,
              sort_order: index,
              created_at: result.updatedAt,
              updated_at: result.updatedAt,
            })),
            tables: tablePlan.tables.map((table, index) => ({
              id: table.id,
              workspace_id: activeWorkspaceId,
              name: table.name,
              capacity: table.capacity,
              locked: table.locked,
              sort_order: index,
              created_at: result.updatedAt,
              updated_at: result.updatedAt,
            })),
            seats: tablePlan.guests.flatMap((guest) => (
              guest.tableId !== null && guest.seatIndex !== null
                ? [{
                  workspace_id: activeWorkspaceId,
                  guest_id: guest.id,
                  table_id: guest.tableId,
                  seat_index: guest.seatIndex,
                  created_at: result.updatedAt,
                  updated_at: result.updatedAt,
                }]
                : []
            )),
            seatingRules: tablePlan.rules.map((rule) => ({
              id: rule.id,
              workspace_id: activeWorkspaceId,
              person_a_id: rule.personAId,
              person_b_id: rule.personBId,
              rule_type: rule.type,
              created_at: result.updatedAt,
            })),
          } : current);
          setWorkspaceMode("cloud_loaded");
          setSyncFeedback("Guest and table changes saved to the shared plan.");
        });
      }, 800);
    }
  }, [activeWorkspaceId]);

  function resolveCloudWorkspace(
    resolvedWorkspace: PlanningWorkspace,
    resolvedSnapshot: PlanningWorkspaceCloudSnapshot,
  ) {
    setBudgetPlan((current) => ({
      ...current,
      weddingDate: resolvedWorkspace.profile.weddingDate,
      guestCount: resolvedWorkspace.profile.guestCount,
      location: resolvedWorkspace.profile.location,
      updatedAt: resolvedWorkspace.profile.updatedAt,
    }));
    setWorkspace(resolvedWorkspace);
    lastTablePlanRef.current = serializeTablePlan(resolvedWorkspace.tablePlan);
    setCloudSnapshot(resolvedSnapshot);
    cloudVersionRef.current = resolvedSnapshot.workspace.updated_at;
    setActiveWorkspaceId(resolvedSnapshot.workspace.id);
    setWorkspaceMode("cloud_loaded");
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", resolvedSnapshot.workspace.id);
    window.history.replaceState(null, "", url);
  }

  const activeCloudSnapshot =
    cloudSnapshot?.workspace.budget_plan_id === budgetPlan.id
      ? cloudSnapshot
      : null;

  if (!ready || !workspace) {
    return <div aria-busy="true" className="h-96 animate-pulse rounded-3xl bg-[#e7dfd2]"><span className="sr-only">Preparing your organised plan.</span></div>;
  }

  const referenceDate = new Date(`${today}T12:00:00`);
  const taskOverview = getPlanningTaskOverview(workspace.tasks, referenceDate);
  const recommendation = getPlanningRecommendation(
    budgetPlan,
    workspace,
    activeWorkspaceId,
    referenceDate,
  );
  const guestOverview = getTablePlanGuestOverview(
    workspace.tablePlan,
    workspace.profile.guestCount ?? 0,
  );

  function saveProfile(profile: WeddingProfile, totalBudgetPence: number) {
    const now = profile.updatedAt;
    const nextBudgetPlan = {
      ...budgetPlan,
      totalBudgetPence,
      weddingDate: profile.weddingDate,
      guestCount: profile.guestCount,
      location: profile.location,
      updatedAt: now,
    };
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
    if (activeWorkspaceId) {
      setSyncFeedback("Saving profile to the shared plan…");
      startCloudTransition(async () => {
        const actions = await import("@/app/actions/planning-workspace");
        const [budgetResult, profileResult] = await Promise.all([
          actions.saveConnectedBudgetPlanAction(activeWorkspaceId, nextBudgetPlan),
          actions.savePlanningWorkspaceProfileAction(activeWorkspaceId, profile),
        ]);
        if (budgetResult.ok && profileResult.ok) {
          setCloudSnapshot((current) => current
            ? { ...current, profile: profileResult.profile }
            : current);
          setWorkspaceMode("cloud_loaded");
          setSyncFeedback("Wedding profile saved to the shared plan.");
        } else {
          setSyncFeedback("The profile remains safe on this device, but the shared copy could not be fully updated.");
        }
      });
    }
  }

  function addTask({
    title,
    category,
    dueDate,
  }: {
    title: string;
    category: PlanningTaskCategory;
    dueDate: string | null;
  }) {
    const task = createPlanningTask(title, {
      category,
      dueDate,
      sortOrder: workspace?.tasks.length ?? 0,
    });
    setWorkspaceMode((current) => current === "cloud_loaded" ? "device_ahead" : current);
    setWorkspace((current) => current ? {
      ...current,
      tasks: [...current.tasks, task],
      updatedAt: new Date().toISOString(),
    } : current);
    if (activeWorkspaceId) {
      setSyncFeedback("Saving task to the shared plan…");
      startCloudTransition(async () => {
        const { createPlanningTaskAction } = await import("@/app/actions/planning-workspace");
        const result = await createPlanningTaskAction({
          id: task.id,
          workspaceId: activeWorkspaceId,
          title: task.title,
          notes: task.notes,
          category: task.category,
          status: task.status,
          dueDate: task.dueDate,
          sortOrder: task.sortOrder,
        });
        if (result.ok) {
          setCloudSnapshot((current) => current
            ? { ...current, tasks: [...current.tasks, result.task] }
            : current);
          setWorkspaceMode("cloud_loaded");
          setSyncFeedback("Task saved to the shared plan.");
        } else {
          setSyncFeedback("The task remains safe on this device, but the shared copy could not be updated.");
        }
      });
    }
  }

  function setTaskStatus(taskId: string, status: PlanningTaskStatus) {
    const now = new Date().toISOString();
    setWorkspaceMode((current) => current === "cloud_loaded" ? "device_ahead" : current);
    setWorkspace((current) => current ? {
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, status, updatedAt: now } : task),
      updatedAt: now,
    } : current);
    if (activeWorkspaceId) {
      setSyncFeedback("Updating the shared task…");
      startCloudTransition(async () => {
        const { updatePlanningTaskAction } = await import("@/app/actions/planning-workspace");
        const result = await updatePlanningTaskAction(taskId, { status });
        if (result.ok) {
          setCloudSnapshot((current) => current ? {
            ...current,
            tasks: current.tasks.map((task) => task.id === result.task.id ? result.task : task),
          } : current);
          setWorkspaceMode("cloud_loaded");
          setSyncFeedback("Task status updated in the shared plan.");
        } else {
          setSyncFeedback("The status remains safe on this device, but the shared copy could not be updated.");
        }
      });
    }
  }

  function updateTaskDetails(
    taskId: string,
    updates: {
      title: string;
      category: PlanningTaskCategory;
      dueDate: string | null;
    },
  ) {
    const now = new Date().toISOString();
    setWorkspaceMode((current) => current === "cloud_loaded" ? "device_ahead" : current);
    setWorkspace((current) => current ? {
      ...current,
      tasks: current.tasks.map((task) => (
        task.id === taskId ? { ...task, ...updates, updatedAt: now } : task
      )),
      updatedAt: now,
    } : current);
    if (activeWorkspaceId) {
      setSyncFeedback("Updating the shared taskâ€¦");
      startCloudTransition(async () => {
        const { updatePlanningTaskAction } = await import("@/app/actions/planning-workspace");
        const result = await updatePlanningTaskAction(taskId, updates);
        if (result.ok) {
          setCloudSnapshot((current) => current ? {
            ...current,
            tasks: current.tasks.map((task) => task.id === result.task.id ? result.task : task),
          } : current);
          setWorkspaceMode("cloud_loaded");
          setSyncFeedback("Task details updated in the shared plan.");
        } else {
          setSyncFeedback("The task changes remain safe on this device, but the shared copy could not be updated.");
        }
      });
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3" aria-label="Planning overview">
        <SummaryCard icon={<CalendarCheck2 size={19} />} label="Open tasks" value={String(taskOverview.openCount)} />
        <SummaryCard icon={<UsersRound size={19} />} label="Invited guests" value={String(guestOverview.totalCount)} />
        <SummaryCard icon={<Check size={19} />} label="Seats assigned" value={`${guestOverview.assignedCount}/${guestOverview.seatingGuestCount}`} />
      </section>

      <PlanningHubBookingOverview
        plan={budgetPlan}
        workspaceId={activeWorkspaceId}
      />

      <PlanningHubPaymentOverview
        plan={budgetPlan}
        today={today}
        workspaceId={activeWorkspaceId}
      />

      <PlanningHubProfile
        onSave={saveProfile}
        profile={workspace.profile}
        totalBudgetPence={budgetPlan.totalBudgetPence}
        workspaceId={activeWorkspaceId}
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
        <PlanningHubTaskList
          onAdd={addTask}
          onStatusChange={setTaskStatus}
          onUpdate={updateTaskDetails}
          tasks={workspace.tasks}
          today={today}
        />

        <aside className="rounded-3xl border border-[#d8c7a7] bg-[#f9f5ed] p-5 sm:p-6">
          <span className="grid size-11 place-items-center rounded-full bg-[#173526] text-white"><LockKeyhole size={19} /></span>
          <h2 className="mt-4 font-display text-2xl font-semibold text-[#173526]">Partner access</h2>
          <p className="mt-2 text-sm leading-6 text-[#625f57]">Secure signed-in partner sharing is prepared behind the local approval gate. It stays disabled until its row-level access tests can run in a free disposable database, and it never uses a public editable link.</p>
          <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs leading-5 text-[#625f57]">
            {partnerAccessMessage({ cloudEnabled, userId, workspaceMode })}
          </p>
          <PlanningPartnerAccess
            cloudEnabled={cloudEnabled}
            snapshot={activeCloudSnapshot}
            userId={userId}
          />
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
        <PlanningHubGuestOverview
          expectedGuestCount={workspace.profile.guestCount ?? 0}
          onOpen={() => setTablePlannerOpen(true)}
          overview={guestOverview}
        />
      )}
      <p className="text-center text-xs leading-5 text-[#58705f]" role="status">
        {syncFeedback ?? workspaceStatusMessage(workspaceMode, cloudEnabled)}
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
