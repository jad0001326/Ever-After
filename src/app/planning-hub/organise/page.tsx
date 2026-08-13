import type { Metadata } from "next";
import { loadLatestBudgetPlan } from "@/app/actions/budget";
import { loadPlanningWorkspaceContextAction, loadPlanningWorkspaceForBudgetAction } from "@/app/actions/planning-workspace";
import { PlanningHubHeader } from "@/components/planning-hub/planning-hub-header";
import { PlanningHubOrganiseWorkspace } from "@/components/planning-hub/planning-hub-organise-workspace";
import { getPlanningHubDateKey } from "@/lib/planning-hub/date";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import type { BudgetPlan } from "@/lib/budget/types";
import type { PlanningWorkspaceCloudSnapshot } from "@/lib/planning-workspace/cloud";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Organise your wedding | My EverAft",
  description: "Keep wedding tasks, guests and table arrangements connected to your EverAft plan.",
  robots: { index: false, follow: false },
};

export default async function PlanningHubOrganisePage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const [cloudPlan, authResult] = await Promise.all([
    loadLatestBudgetPlan(),
    supabase?.auth.getUser() ?? Promise.resolve({ data: { user: null } }),
  ]);
  const user = authResult.data.user;
  let initialBudgetPlan = cloudPlan ?? createPlanningHubStarterPlan(user?.id ?? null);
  let initialBudgetPlanIsFallback = !cloudPlan;
  const planningCloudEnabled = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED === "true";
  let initialCloudSnapshot: PlanningWorkspaceCloudSnapshot | null = null;

  let workspaceNotice: string | null = null;

  if (planningCloudEnabled && user) {
    const workspaceResult = params.workspace
      ? await loadPlanningWorkspaceContextAction(params.workspace)
      : await loadPlanningWorkspaceForBudgetAction(initialBudgetPlan.id);
    if (params.workspace && workspaceResult.ok && "budgetPlan" in workspaceResult) {
      initialBudgetPlan = workspaceResult.budgetPlan as BudgetPlan;
      initialBudgetPlanIsFallback = false;
    }
    if (workspaceResult.ok && workspaceResult.snapshot) {
      initialCloudSnapshot = {
        workspace: workspaceResult.snapshot.workspace,
        profile: workspaceResult.snapshot.profile,
        members: workspaceResult.snapshot.members,
        invites: workspaceResult.snapshot.invites,
        tasks: workspaceResult.snapshot.tasks,
        guests: workspaceResult.snapshot.guests,
        tables: workspaceResult.snapshot.tables,
        seats: workspaceResult.snapshot.seats,
        seatingRules: workspaceResult.snapshot.seatingRules,
      };
    } else if (params.workspace) {
      workspaceNotice = "message" in workspaceResult
        ? workspaceResult.message
        : "That connected plan could not be loaded.";
    }
  }

  return (
    <>
      <PlanningHubHeader stage="organise" workspaceId={initialCloudSnapshot?.workspace.id ?? params.workspace} />
      <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <PlanningHubOrganiseWorkspace
          cloudEnabled={planningCloudEnabled}
          connectedWorkspaceId={initialCloudSnapshot?.workspace.id ?? null}
          initialBudgetPlan={initialBudgetPlan}
          initialBudgetPlanIsFallback={initialBudgetPlanIsFallback}
          initialCloudSnapshot={initialCloudSnapshot}
          today={getPlanningHubDateKey()}
          userId={user?.id ?? null}
        />
        {workspaceNotice ? (
          <p className="mt-4 rounded-2xl border border-[#e2c7ad] bg-[#fff8ef] px-4 py-3 text-sm text-[#744629]" role="status">
            {workspaceNotice} Your personal device plan has not been replaced.
          </p>
        ) : null}
      </div>
    </>
  );
}
