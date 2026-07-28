import type { Metadata } from "next";
import { Suspense } from "react";
import { loadLatestBudgetPlan } from "@/app/actions/budget";
import { loadPlanningWorkspaceContextAction } from "@/app/actions/planning-workspace";
import { PlanningHubHeader } from "@/components/planning-hub/planning-hub-header";
import { PlanningHubPhotographyFilters } from "@/components/planning-hub/planning-hub-photography-filters";
import { PlanningHubPhotographyWorkspace } from "@/components/planning-hub/planning-hub-photography-workspace";
import { getPlanningHubDateKey } from "@/lib/planning-hub/date";
import { calculatePlanningHubPlan, createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import { searchPlanningHubPhotographers } from "@/lib/planning-hub/photographers";
import type { PlanningHubPhotographySearchParams } from "@/lib/planning-hub/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Photography — My EverAft Planning Hub Beta",
  description: "Match Scottish wedding photographers to your venue, location and connected wedding plan.",
  robots: { index: false, follow: false }
};

export default async function PlanningHubPhotographyPage({
  searchParams
}: {
  searchParams: Promise<PlanningHubPhotographySearchParams>;
}) {
  const params = await searchParams;
  return (
    <>
      <PlanningHubHeader stage="photography" workspaceId={params.workspace} />
      <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<PhotographyWorkspaceFallback />}>
          <PlanningHubPhotographyContent searchParams={Promise.resolve(params)} />
        </Suspense>
      </main>
    </>
  );
}

async function PlanningHubPhotographyContent({
  searchParams
}: {
  searchParams: Promise<PlanningHubPhotographySearchParams>;
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
  const initialPlan = connectedContext?.budgetPlan ?? cloudPlan ?? createPlanningHubStarterPlan(user?.id ?? null);
  const effectiveParams: PlanningHubPhotographySearchParams = {
    ...params,
    venue: params.venue ?? initialPlan.selectedVenueId ?? undefined,
    location: params.location ?? initialPlan.location ?? undefined
  };
  const results = await searchPlanningHubPhotographers(effectiveParams);
  const selectedVenueName = initialPlan.items.find(
    (item) => item.categoryId === "venue" && item.listingId === initialPlan.selectedVenueId
  )?.itemName ?? null;
  const budget = calculatePlanningHubPlan(initialPlan);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
      <PlanningHubPhotographyFilters
        params={effectiveParams}
        remainingPence={budget.remainingPence}
        selectedVenueName={selectedVenueName}
        weddingDate={initialPlan.weddingDate}
      />
      <PlanningHubPhotographyWorkspace
        connectedWorkspaceId={connectedContext?.snapshot.workspace.id ?? null}
        initialPlan={initialPlan}
        results={results}
        searchParams={effectiveParams}
        today={getPlanningHubDateKey()}
        userId={user?.id ?? null}
      />
    </div>
  );
}

function PhotographyWorkspaceFallback() {
  return (
    <div aria-busy="true" aria-label="Loading photography planning workspace" className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
      <div className="h-[34rem] rounded-3xl bg-[#e7dfd2]" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => <div className="h-80 rounded-3xl bg-[#e7dfd2]" key={index} />)}
      </div>
      <div className="h-[30rem] rounded-3xl bg-[#e7dfd2]" />
      <span className="sr-only">Loading photographers and your connected plan.</span>
    </div>
  );
}
