"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BudgetPlan } from "@/lib/budget/types";
import { withPlanningWorkspace } from "@/lib/planning-hub/navigation";
import type {
  PlanningHubSupplierCategory,
  PlanningHubSupplierResults as ResultData,
  PlanningHubSupplierSearchParams,
} from "@/lib/planning-hub/types";
import { PlanningHubSupplierCard } from "./planning-hub-supplier-card";

export function PlanningHubSupplierResults({
  category,
  comparedSupplierIds,
  onCompare,
  onOpen,
  plan,
  results,
  searchParams,
}: {
  category: PlanningHubSupplierCategory;
  comparedSupplierIds: Set<string>;
  onCompare: (supplierId: string) => void;
  onOpen: (supplierId: string) => void;
  plan: BudgetPlan;
  results: ResultData;
  searchParams: PlanningHubSupplierSearchParams;
}) {
  const planItemsBySupplier = new Map(
    plan.items
      .filter((item) => item.categoryId === category.budgetCategoryId && item.supplierType === category.label && item.bookingStatus !== "cancelled" && item.listingId)
      .map((item) => [item.listingId!, item]),
  );
  const route = `/planning-hub/suppliers/${category.slug}`;
  const manualHash = `#manual-${category.slug}`;

  if (results.error) {
    return (
      <section className="rounded-3xl border border-[#e6b8a0] bg-[#fff4ed] p-8 text-center">
        <h2 className="font-display text-3xl font-semibold text-[#713817]">{category.label} search needs attention</h2>
        <p className="mt-3 text-sm leading-6 text-[#7c4b32]">{results.error}</p>
        <a className="focus-ring mt-5 inline-flex min-h-11 items-center rounded-full bg-[#713817] px-5 text-sm font-semibold text-white" href={manualHash}>Add a {category.label.toLowerCase()} manually</a>
      </section>
    );
  }

  if (results.suppliers.length === 0) {
    return (
      <section className="rounded-3xl border border-[#d9d0c3] bg-white p-8 text-center sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9c542d]">No exact match yet</p>
        <h2 className="mt-3 font-display text-4xl font-semibold text-[#173526]">Your {category.label.toLowerCase()} can still belong in the plan.</h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[#625f57]">Widen a filter or add a {category.label.toLowerCase()} EverAft does not list yet.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="focus-ring inline-flex min-h-11 items-center rounded-full border border-[#173526] px-5 text-sm font-semibold text-[#173526]" href={withPlanningWorkspace(route, searchParams.workspace)} prefetch={false}>Clear filters</Link>
          <a className="focus-ring inline-flex min-h-11 items-center rounded-full bg-[#173526] px-5 text-sm font-semibold text-white" href={manualHash}>Add manually</a>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={`Matching wedding ${category.plural.toLowerCase()}`}>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9c542d]">Matched to your plan</p>
        <h2 className="mt-1 font-display text-3xl font-semibold text-[#173526]">{category.plural} for your plan</h2>
        <p className="mt-2 text-sm text-[#625f57]">{results.total} {results.total === 1 ? `${category.label.toLowerCase()} matches` : `${category.plural.toLowerCase()} match`} your current filters.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {results.suppliers.map((supplier, index) => (
          <PlanningHubSupplierCard
            bookingStatus={planItemsBySupplier.get(supplier.id)?.bookingStatus ?? null}
            category={category}
            compared={comparedSupplierIds.has(supplier.id)}
            key={supplier.id}
            onCompare={() => onCompare(supplier.id)}
            onOpen={() => onOpen(supplier.id)}
            priority={index === 0}
            supplier={supplier}
          />
        ))}
      </div>
      <nav aria-label={`${category.label} result pages`} className="mt-8 flex items-center justify-between gap-3">
        <PageLink disabled={results.page <= 1} href={buildHref(category.slug, { ...searchParams, page: String(results.page - 1) })}>
          <ChevronLeft size={16} /> Previous
        </PageLink>
        <span className="text-xs font-medium text-[#625f57]">Page {results.page} of {results.totalPages}</span>
        <PageLink disabled={results.page >= results.totalPages} href={buildHref(category.slug, { ...searchParams, page: String(results.page + 1) })}>
          Next <ChevronRight size={16} />
        </PageLink>
      </nav>
    </section>
  );
}

function buildHref(categorySlug: string, params: PlanningHubSupplierSearchParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return `/planning-hub/suppliers/${categorySlug}${query.size ? `?${query.toString()}` : ""}`;
}

function PageLink({ children, disabled, href }: { children: ReactNode; disabled: boolean; href: string }) {
  return disabled
    ? <span className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-[#625f57]">{children}</span>
    : <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9d0c3] bg-white px-4 text-sm font-semibold text-[#173526]" href={href} prefetch={false} scroll={false}>{children}</Link>;
}
