import { loadLatestBudgetPlan } from "@/app/actions/budget";
import { BudgetPlanner } from "@/components/budget/budget-planner";
import type { BudgetStarter } from "@/lib/budget/starters";
import { createClient } from "@/lib/supabase/server";
import { getBudgetPlannerSupplierListings } from "@/lib/suppliers";
import { getBudgetPlannerVenueListings } from "@/lib/venues";

export async function BudgetPlannerPage({ requestedListing, starter = null }: { requestedListing?: string; starter?: BudgetStarter | null }) {
  const [venues, suppliers, supabase] = await Promise.all([getBudgetPlannerVenueListings(), getBudgetPlannerSupplierListings(), createClient()]);
  const listings = [...venues, ...suppliers];
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const cloudPlan = user ? await loadLatestBudgetPlan() : null;
  const preselectedListing = requestedListing ? listings.find((listing) => listing.id === requestedListing || listing.slug === requestedListing) ?? null : null;

  return <BudgetPlanner cloudPlan={cloudPlan} listings={listings} preselectedListing={preselectedListing} starterTemplate={starter} userId={user?.id ?? null} />;
}
