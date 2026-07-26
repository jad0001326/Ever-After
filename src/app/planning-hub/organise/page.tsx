import type { Metadata } from "next";
import { loadLatestBudgetPlan } from "@/app/actions/budget";
import { PlanningHubHeader } from "@/components/planning-hub/planning-hub-header";
import { PlanningHubOrganiseWorkspace } from "@/components/planning-hub/planning-hub-organise-workspace";
import { createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
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

  return (
    <>
      <PlanningHubHeader stage="organise" />
      <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <PlanningHubOrganiseWorkspace initialBudgetPlan={initialBudgetPlan} userId={user?.id ?? null} />
      </main>
    </>
  );
}
