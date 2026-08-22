"use client";

import { CloudUpload, RotateCcw, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import type { BudgetPlan } from "@/lib/budget/types";
import {
  planningWorkspaceFromCloud,
  planningWorkspaceToImportSnapshot,
} from "@/lib/planning-workspace/cloud";
import type {
  PlanningWorkspaceCloudSnapshot,
  PlanningWorkspaceStartupMode,
} from "@/lib/planning-workspace/cloud";
import {
  PLANNING_WORKSPACE_BACKUP_STORAGE_KEY,
  serializePlanningWorkspace,
} from "@/lib/planning-workspace/workspace";
import type { PlanningWorkspace } from "@/lib/planning-workspace/types";

export function PlanningWorkspaceCloudImport({
  budgetPlan,
  cloudEnabled,
  cloudSnapshot,
  mode,
  onWorkspaceResolved,
  userId,
  workspace,
}: {
  budgetPlan: BudgetPlan;
  cloudEnabled: boolean;
  cloudSnapshot: PlanningWorkspaceCloudSnapshot | null;
  mode: PlanningWorkspaceStartupMode;
  onWorkspaceResolved: (
    workspace: PlanningWorkspace,
    snapshot: PlanningWorkspaceCloudSnapshot,
  ) => void;
  userId: string | null;
  workspace: PlanningWorkspace;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [requiresReload, setRequiresReload] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!cloudEnabled || !userId || mode === "cloud_loaded") return null;

  const hasCloudCopy = cloudSnapshot !== null;
  const hasUnavailableCloudLink = !hasCloudCopy && workspace.cloudWorkspaceId !== null;
  const canImportDeviceCopy = !hasCloudCopy || cloudSnapshot.workspace.owner_id === userId;
  const actionLabel = hasCloudCopy
    ? "Review device and cloud copies"
    : "Review secure cloud import";

  function useCloudCopy() {
    if (!cloudSnapshot) return;
    window.localStorage.setItem(
      PLANNING_WORKSPACE_BACKUP_STORAGE_KEY,
      serializePlanningWorkspace(workspace),
    );
    onWorkspaceResolved(planningWorkspaceFromCloud(cloudSnapshot), cloudSnapshot);
    setFeedback("The cloud copy is now open. Your previous device copy was saved as a local backup.");
    setReviewOpen(false);
  }

  function importDeviceCopy() {
    if (requiresReload || hasUnavailableCloudLink) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const { importPlanningWorkspaceSnapshotAction } = await import("@/app/actions/planning-workspace");
        const result = await importPlanningWorkspaceSnapshotAction({
          budgetPlan,
          snapshot: planningWorkspaceToImportSnapshot(workspace),
          targetWorkspaceId: cloudSnapshot?.workspace.id ?? null,
          expectedUpdatedAt: cloudSnapshot?.workspace.updated_at ?? null,
        });
        if (!result.ok) {
          setFeedback(`${result.message} Your device copy remains safe.`);
          setRequiresReload(true);
          return;
        }

        const importedSnapshot: PlanningWorkspaceCloudSnapshot = {
          workspace: result.snapshot.workspace,
          profile: result.snapshot.profile,
          members: result.snapshot.members,
          invites: result.snapshot.invites,
          tasks: result.snapshot.tasks,
          guests: result.snapshot.guests,
          tables: result.snapshot.tables,
          seats: result.snapshot.seats,
          seatingRules: result.snapshot.seatingRules,
        };
        onWorkspaceResolved(planningWorkspaceFromCloud(importedSnapshot), importedSnapshot);
        setFeedback("Your device plan is now connected to the secure cloud workspace.");
        setReviewOpen(false);
      } catch {
        setFeedback("The import could not be confirmed. Your device copy remains safe; reload before retrying.");
        setRequiresReload(true);
      }
    });
  }

  return (
    <div className="mt-4">
      {!reviewOpen ? (
        <button
          className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#31533b] bg-white px-4 text-sm font-semibold text-[#173526]"
          onClick={() => setReviewOpen(true)}
          type="button"
        >
          <ShieldCheck aria-hidden="true" size={17} />
          {actionLabel}
        </button>
      ) : (
        <section
          aria-label="Review cloud workspace import"
          className="rounded-2xl border border-[#cdbb9b] bg-white p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#95502b]">
            Review before changing cloud data
          </p>
          <p className="mt-2 text-sm leading-6 text-[#4f504a]">
            This device has {workspace.tasks.length} tasks, {workspace.tablePlan.guests.length} guests
            and {workspace.tablePlan.tables.length} tables. Nothing changes until you choose below.
          </p>

          {hasUnavailableCloudLink ? (
            <p className="mt-3 rounded-xl bg-[#fff4e9] px-3 py-2 text-xs leading-5 text-[#7b4628]">
              This device remembers a cloud link that is not currently available. Reload or sign in
              with the workspace owner before importing.
            </p>
          ) : null}
          {hasCloudCopy && !canImportDeviceCopy ? (
            <p className="mt-3 rounded-xl bg-[#eef4ef] px-3 py-2 text-xs leading-5 text-[#31533b]">
              Only the workspace owner can replace the shared cloud copy. You can safely keep that
              cloud copy on this device.
            </p>
          ) : null}

          <div className="mt-4 grid gap-2">
            {canImportDeviceCopy ? (
              <button
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#173526] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending || requiresReload || hasUnavailableCloudLink}
                onClick={importDeviceCopy}
                type="button"
              >
                <CloudUpload aria-hidden="true" size={17} />
                {isPending
                  ? "Importing securely…"
                  : hasCloudCopy
                    ? "Replace cloud with this device plan"
                    : "Create cloud copy from this device"}
              </button>
            ) : null}
            {hasCloudCopy ? (
              <button
                className="focus-ring min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-semibold text-[#173526]"
                disabled={isPending}
                onClick={useCloudCopy}
                type="button"
              >
                Keep the cloud copy on this device
              </button>
            ) : null}
            <button
              className="focus-ring min-h-11 rounded-full px-4 text-sm font-semibold text-[#625f57]"
              disabled={isPending}
              onClick={() => setReviewOpen(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {feedback ? (
        <div
          aria-live="polite"
          className="mt-3 rounded-2xl bg-white px-4 py-3 text-xs leading-5 text-[#4f504a]"
          role="status"
        >
          <p>{feedback}</p>
          {requiresReload ? (
            <button
              className="focus-ring mt-2 inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--line)] px-3 font-semibold text-[#173526]"
              onClick={() => window.location.reload()}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={15} />
              Reload safely
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
