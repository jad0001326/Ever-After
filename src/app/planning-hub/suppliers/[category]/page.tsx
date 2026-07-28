import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { loadLatestBudgetPlan } from "@/app/actions/budget";
import { loadPlanningWorkspaceContextAction } from "@/app/actions/planning-workspace";
import { PlanningHubHeader } from "@/components/planning-hub/planning-hub-header";
import { PlanningHubSupplierFilters } from "@/components/planning-hub/planning-hub-supplier-filters";
import { PlanningHubSupplierWorkspace } from "@/components/planning-hub/planning-hub-supplier-workspace";
import { getPlanningHubDateKey } from "@/lib/planning-hub/date";
import { calculatePlanningHubPlan, createPlanningHubStarterPlan } from "@/lib/planning-hub/plan";
import { getPlanningHubSupplierCategory } from "@/lib/planning-hub/supplier-search";
import { searchPlanningHubSuppliers } from "@/lib/planning-hub/suppliers";
import type {
  PlanningHubSupplierCategory,
  PlanningHubSupplierSearchParams,
} from "@/lib/planning-hub/types";
import { createClient } from "@/lib/supabase/server";

type SupplierPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<PlanningHubSupplierSearchParams>;
};

export async function generateMetadata({ params }: SupplierPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = getPlanningHubSupplierCategory(categorySlug);
  return {
    title: category ? `${category.plural} — My EverAft Planning Hub Beta` : "Supplier stage unavailable — My EverAft",
    description: category
      ? category.live
        ? `Match Scottish wedding ${category.plural.toLowerCase()} to your venue, location and connected wedding plan.`
        : `Add your chosen ${category.label.toLowerCase()} manually and keep estimates, quotes, bookings and payments in your connected wedding plan.`
      : "This Planning Hub supplier stage is not available.",
    robots: { index: false, follow: false },
  };
}

export default async function PlanningHubSupplierPage({
  params,
  searchParams,
}: SupplierPageProps) {
  const [{ category: categorySlug }, query] = await Promise.all([params, searchParams]);
  const category = getPlanningHubSupplierCategory(categorySlug);
  if (!category) notFound();
  if (category.slug === "photographer") {
    redirect(buildPhotographyHref(query));
  }
  const supplierCategory: PlanningHubSupplierCategory = {
    slug: category.slug,
    label: category.label,
    plural: category.plural,
    budgetCategoryId: category.budgetCategoryId,
  };

  return (
    <>
      <PlanningHubHeader stage="supplier" supplierCategory={supplierCategory} workspaceId={query.workspace} />
      <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<SupplierWorkspaceFallback catalogueLive={category.live} category={supplierCategory} />}>
          <PlanningHubSupplierContent catalogueLive={category.live} category={supplierCategory} searchParams={Promise.resolve(query)} />
        </Suspense>
      </div>
    </>
  );
}

async function PlanningHubSupplierContent({
  catalogueLive,
  category,
  searchParams,
}: {
  catalogueLive: boolean;
  category: PlanningHubSupplierCategory;
  searchParams: Promise<PlanningHubSupplierSearchParams>;
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
  const effectiveParams: PlanningHubSupplierSearchParams = {
    ...params,
    venue: params.venue ?? initialPlan.selectedVenueId ?? undefined,
    location: params.location ?? initialPlan.location ?? undefined,
  };
  const results = catalogueLive
    ? await searchPlanningHubSuppliers(category.slug, effectiveParams)
    : { suppliers: [], total: 0, page: 1, totalPages: 1 };
  const selectedVenueName = initialPlan.items.find(
    (item) => item.categoryId === "venue" && item.listingId === initialPlan.selectedVenueId,
  )?.itemName ?? null;
  const budget = calculatePlanningHubPlan(initialPlan);

  return (
    <div className={catalogueLive ? "grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]" : ""}>
      {catalogueLive ? (
        <PlanningHubSupplierFilters
          category={category}
          params={effectiveParams}
          remainingPence={budget.remainingPence}
          selectedVenueName={selectedVenueName}
          weddingDate={initialPlan.weddingDate}
        />
      ) : null}
      <PlanningHubSupplierWorkspace
        catalogueLive={catalogueLive}
        category={category}
        connectedWorkspaceId={connectedContext?.snapshot.workspace.id ?? null}
        initialPlan={initialPlan}
        initialPlanIsFallback={!connectedContext && !cloudPlan}
        results={results}
        searchParams={effectiveParams}
        today={getPlanningHubDateKey()}
        userId={user?.id ?? null}
      />
    </div>
  );
}

function SupplierWorkspaceFallback({
  catalogueLive,
  category,
}: {
  catalogueLive: boolean;
  category: PlanningHubSupplierCategory;
}) {
  return (
    <div aria-busy="true" aria-label={`Loading ${category.label.toLowerCase()} planning workspace`} className={catalogueLive ? "grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"}>
      {catalogueLive ? <div className="h-[34rem] rounded-3xl bg-[#e7dfd2]" /> : null}
      <div className={catalogueLive ? "grid gap-4 sm:grid-cols-2" : "h-80 rounded-3xl bg-[#e7dfd2]"}>
        {catalogueLive ? Array.from({ length: 6 }, (_, index) => <div className="h-80 rounded-3xl bg-[#e7dfd2]" key={index} />) : null}
      </div>
      <div className="h-[30rem] rounded-3xl bg-[#e7dfd2]" />
      <span className="sr-only">Loading {category.plural.toLowerCase()} and your connected plan.</span>
    </div>
  );
}

function buildPhotographyHref(params: PlanningHubSupplierSearchParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return `/planning-hub/photography${query.size ? `?${query.toString()}` : ""}`;
}
