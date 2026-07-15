import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BudgetPlannerPage } from "@/components/budget/budget-planner-page";
import { budgetStarters, getBudgetStarter } from "@/lib/budget/starters";
import { buildMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ budget: string }> };

export function generateStaticParams() {
  return budgetStarters.map(({ slug }) => ({ budget: slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { budget } = await params;
  const starter = getBudgetStarter(budget);
  if (!starter) return {};
  const formattedBudget = Number(starter.slug).toLocaleString("en-GB");

  return buildMetadata({
    title: `£${formattedBudget} Wedding Budget Example`,
    description: `${starter.description} Open the free EverAft planner and adapt every estimate to your own wedding.`,
    path: `/wedding-budget-planner/${starter.slug}`,
    image: null,
    keywords: [`£${formattedBudget} wedding budget`, `${formattedBudget} wedding budget breakdown`, "UK wedding budget example"]
  });
}

export default async function StarterBudgetPage({ params }: PageProps) {
  const { budget } = await params;
  const starter = getBudgetStarter(budget);
  if (!starter) notFound();

  return <BudgetPlannerPage starter={starter} />;
}
