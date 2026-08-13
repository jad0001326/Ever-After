"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BudgetPlan } from "@/lib/budget/types";
import { withPlanningWorkspace } from "@/lib/planning-hub/navigation";
import type { PlanningHubPhotographerResults as ResultData, PlanningHubPhotographySearchParams } from "@/lib/planning-hub/types";
import { PlanningHubPhotographerCard } from "./planning-hub-photographer-card";

export function PlanningHubPhotographerResults({
  comparedPhotographerIds,
  plan,
  results,
  searchParams,
  onCompare,
  onOpen
}: {
  comparedPhotographerIds: Set<string>;
  plan: BudgetPlan;
  results: ResultData;
  searchParams: PlanningHubPhotographySearchParams;
  onCompare: (photographerId: string) => void;
  onOpen: (photographerId: string) => void;
}) {
  const planItemsByPhotographer = new Map(
    plan.items
      .filter((item) => item.categoryId === "photography" && item.bookingStatus !== "cancelled" && item.listingId)
      .map((item) => [item.listingId!, item])
  );

  if (results.error) {
    return (
      <section className="rounded-3xl border border-[#e6b8a0] bg-[#fff4ed] p-8 text-center">
        <h2 className="font-display text-3xl font-semibold text-[#713817]">Photography search needs attention</h2>
        <p className="mt-3 text-sm leading-6 text-[#7c4b32]">{results.error}</p>
        <a className="focus-ring mt-5 inline-flex min-h-11 items-center rounded-full bg-[#713817] px-5 text-sm font-semibold text-white" href="#manual-photographer">Add a photographer manually</a>
      </section>
    );
  }

  if (results.photographers.length === 0) {
    return (
      <section className="rounded-3xl border border-[#d9d0c3] bg-white p-8 text-center sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9c542d]">No exact match yet</p>
        <h2 className="mt-3 font-display text-4xl font-semibold text-[#173526]">Your photographer can still belong in the plan.</h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[#625f57]">Widen a filter or add a photographer EverAft does not list yet.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="focus-ring inline-flex min-h-11 items-center rounded-full border border-[#173526] px-5 text-sm font-semibold text-[#173526]" href={withPlanningWorkspace("/planning-hub/photography", searchParams.workspace)} prefetch={false}>Clear filters</Link>
          <a className="focus-ring inline-flex min-h-11 items-center rounded-full bg-[#173526] px-5 text-sm font-semibold text-white" href="#manual-photographer">Add manually</a>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Matching wedding photographers">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9c542d]">Recommended next</p>
        <h2 className="mt-1 font-display text-3xl font-semibold text-[#173526]">Photographers for your plan</h2>
        <p className="mt-2 text-sm text-[#625f57]">{results.total} {results.total === 1 ? "photographer matches" : "photographers match"} your current filters.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {results.photographers.map((photographer, index) => (
          <PlanningHubPhotographerCard
            bookingStatus={planItemsByPhotographer.get(photographer.id)?.bookingStatus ?? null}
            compared={comparedPhotographerIds.has(photographer.id)}
            key={photographer.id}
            onCompare={() => onCompare(photographer.id)}
            onOpen={() => onOpen(photographer.id)}
            photographer={photographer}
            priority={index === 0}
          />
        ))}
      </div>
      <nav aria-label="Photographer result pages" className="mt-8 flex items-center justify-between gap-3">
        <PageLink disabled={results.page <= 1} href={buildHref({ ...searchParams, page: String(results.page - 1) })}>
          <ChevronLeft size={16} /> Previous
        </PageLink>
        <span className="text-xs font-medium text-[#625f57]">Page {results.page} of {results.totalPages}</span>
        <PageLink disabled={results.page >= results.totalPages} href={buildHref({ ...searchParams, page: String(results.page + 1) })}>
          Next <ChevronRight size={16} />
        </PageLink>
      </nav>
    </section>
  );
}

function buildHref(params: PlanningHubPhotographySearchParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return `/planning-hub/photography${query.size ? `?${query.toString()}` : ""}`;
}

function PageLink({ children, disabled, href }: { children: ReactNode; disabled: boolean; href: string }) {
  return disabled
    ? <span className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-[#625f57]">{children}</span>
    : <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9d0c3] bg-white px-4 text-sm font-semibold text-[#173526]" href={href} prefetch={false} scroll={false}>{children}</Link>;
}
