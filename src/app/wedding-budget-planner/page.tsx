import type { Metadata } from "next";
import { BudgetPlanner } from "@/components/budget/budget-planner";
import { loadLatestBudgetPlan } from "@/app/actions/budget";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getBudgetPlannerVenueListings } from "@/lib/venues";

export const metadata: Metadata = buildMetadata({ title: "Free Wedding Budget Planner", description: "Plan your wedding budget, add venues and suppliers, track payments and see exactly how much you have left.", path: "/wedding-budget-planner", keywords: ["free wedding budget planner", "UK wedding budget calculator", "wedding payment tracker"] });
export default async function WeddingBudgetPlannerPage({ searchParams }: { searchParams: Promise<{ venue?: string; supplier?: string }> }) {
  const [params, listings, supabase] = await Promise.all([searchParams, getBudgetPlannerVenueListings(), createClient()]);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const cloudPlan = user ? await loadLatestBudgetPlan() : null; const requestedListing = params.venue ?? params.supplier;
  const preselectedListing = requestedListing ? listings.find((listing) => listing.id === requestedListing || listing.slug === requestedListing) ?? null : null;
  return <BudgetPlanner listings={listings} cloudPlan={cloudPlan} userId={user?.id ?? null} preselectedListing={preselectedListing} />;
}

