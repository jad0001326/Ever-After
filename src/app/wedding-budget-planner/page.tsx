import type { Metadata } from "next";
import { BudgetPlannerPage } from "@/components/budget/budget-planner-page";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: "Free Wedding Budget Planner", description: "Plan your wedding budget, add venues and suppliers, track payments and see exactly how much you have left.", path: "/wedding-budget-planner", keywords: ["free wedding budget planner", "UK wedding budget calculator", "wedding payment tracker"] });
export default async function WeddingBudgetPlannerPage({ searchParams }: { searchParams: Promise<{ venue?: string; supplier?: string }> }) {
  const params = await searchParams;
  return <BudgetPlannerPage requestedListing={params.venue ?? params.supplier} />;
}

