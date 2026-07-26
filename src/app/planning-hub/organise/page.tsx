import type { Metadata } from "next";
import { loadLatestBudgetPlan } from "@/app/actions/budget";
import { loadPlanningWorkspaceForBudgetAction } from "@/app/actions/planning-workspace";
import { PlanningHubHeader } from "@/components/planning-hub/planning-hub-header";
import { PlanningHubOrganiseWorkspace } from "@/components/planning-hub/planning-hub-organise-workspace";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import type { PlanningWorkspaceCloudSnapshot } from "@/lib/planning-workspace/cloud";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Organise your wedding | My EverAft",
  description: "Keep wedding tasks, guests and table arrangements connected to your EverAft plan.",
  robots: { index: false, follow: false },
};

export default async function PlanningHubOrganisePage() {
  const supabase = await createClient();
  const [cloudPlan, authResult] = await Promise.all([
    loadLatestBudgetPlan(),
    supabase?.auth.getUser() ?? Promise.resolve({ data: { user: null } }),
  ]);
  const user = authResult.data.user;
  const initialBudgetPlan = cloudPlan ?? createPlanningHubStarterPlan(user?.id ?? null);
  const planningCloudEnabled = process.env.PLANNING_WORKSPACE_CLOUD_ENABLED === "true";
  let initialCloudSnapshot: PlanningWorkspaceCloudSnapshot | null = null;

  if (planningCloudEnabled && user) {
    const workspaceResult = await loadPlanningWorkspaceForBudgetAction(initialBudgetPlan.id);
    if (workspaceResult.ok && workspaceResult.snapshot) {
      initialCloudSnapshot = {
        workspace: workspaceResult.snapshot.workspace,
        tasks: workspaceResult.snapshot.tasks,
        guests: workspaceResult.snapshot.guests,
        tables: workspaceResult.snapshot.tables,
        seats: workspaceResult.snapshot.seats,
        seatingRules: workspaceResult.snapshot.seatingRules,
      };
    }
  }

  return (
    <>
      <PlanningHubHeader stage="organise" />
      <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <PlanningHubOrganiseWorkspace
          cloudEnabled={planningCloudEnabled}
          initialBudgetPlan={initialBudgetPlan}
          initialCloudSnapshot={initialCloudSnapshot}
          userId={user?.id ?? null}
        />
      </main>
    </>
  );
}
