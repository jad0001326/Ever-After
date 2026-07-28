import type { Metadata } from "next";
import { loadLatestBudgetPlan } from "@/app/actions/budget";
import { loadPlanningWorkspaceContextAction } from "@/app/actions/planning-workspace";
import { PlanningHubHeader } from "@/components/planning-hub/planning-hub-header";
import { PlanningHubSupplierRoadmap } from "@/components/planning-hub/planning-hub-supplier-roadmap";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Wedding suppliers | My EverAft Planning Hub",
  description: "Choose the next supplier stage and keep estimates, quotes, bookings and payments in one wedding plan.",
  robots: { index: false, follow: false },
};

export default async function PlanningHubSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const [cloudPlan, authResult, connectedResult] = await Promise.all([
    loadLatestBudgetPlan(),
    supabase?.auth.getUser() ?? Promise.resolve({ data: { user: null } }),
    params.workspace ? loadPlanningWorkspaceContextAction(params.workspace) : Promise.resolve(null),
  ]);
  const user = authResult.data.user;
  const connectedContext = connectedResult?.ok ? connectedResult : null;
  const initialPlan = connectedContext?.budgetPlan
    ?? cloudPlan
    ?? createPlanningHubStarterPlan(user?.id ?? null);
  const connectedWorkspaceId = connectedContext?.snapshot.workspace.id ?? null;

  return (
    <>
      <PlanningHubHeader stage="suppliers" workspaceId={connectedWorkspaceId ?? params.workspace} />
      <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <PlanningHubSupplierRoadmap
          connectedWorkspaceId={connectedWorkspaceId}
          initialPlan={initialPlan}
          initialPlanIsFallback={!connectedContext && !cloudPlan}
        />
      </div>
    </>
  );
}
