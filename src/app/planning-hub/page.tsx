import type { Metadata } from "next";
import { Suspense } from "react";
import { loadLatestBudgetPlan } from "@/app/actions/budget";
import { PlanningHubFilters } from "@/components/planning-hub/planning-hub-filters";
import { PlanningHubHeader } from "@/components/planning-hub/planning-hub-header";
import { PlanningHubWorkspace } from "@/components/planning-hub/planning-hub-workspace";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import { searchPlanningHubVenues } from "@/lib/planning-hub/venues";
import { createClient } from "@/lib/supabase/server";
import type { PlanningHubSearchParams } from "@/lib/planning-hub/types";

export const metadata: Metadata = {
  title: "My EverAft — Planning Hub Beta",
  description: "Turn Scottish wedding venue discovery into a connected wedding plan.",
  robots: { index: false, follow: false }
};

export default function PlanningHubPage({
  searchParams
}: {
  searchParams: Promise<PlanningHubSearchParams>;
}) {
  return (
    <>
      <PlanningHubHeader />
      <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<PlanningHubWorkspaceFallback />}>
          <PlanningHubContent searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function PlanningHubContent({ searchParams }: { searchParams: Promise<PlanningHubSearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [results, cloudPlan, authResult] = await Promise.all([
    searchPlanningHubVenues(params),
    loadLatestBudgetPlan(),
    supabase?.auth.getUser() ?? Promise.resolve({ data: { user: null } })
  ]);
  const user = authResult.data.user;
  const { data: favourites } = user && supabase
    ? await supabase.from("favourites").select("venue_id").eq("user_id", user.id)
    : { data: [] };
  const initialPlan = cloudPlan ?? createPlanningHubStarterPlan(user?.id ?? null);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
      <PlanningHubFilters params={params} resultCount={results.total} />
      <PlanningHubWorkspace
        initialPlan={initialPlan}
        initialSavedVenueIds={(favourites ?? []).map((favourite) => favourite.venue_id)}
        results={results}
        searchParams={params}
        userId={user?.id ?? null}
      />
    </div>
  );
}

function PlanningHubWorkspaceFallback() {
  return (
    <div aria-busy="true" aria-label="Loading your planning workspace" className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
      <div className="h-[34rem] animate-pulse rounded-3xl bg-[#e7dfd2]" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => <div className="h-80 animate-pulse rounded-3xl bg-[#e7dfd2]" key={index} />)}
      </div>
      <div className="h-[30rem] animate-pulse rounded-3xl bg-[#e7dfd2]" />
      <span className="sr-only">Loading venues and your connected plan.</span>
    </div>
  );
}
