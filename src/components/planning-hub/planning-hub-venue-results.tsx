"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BudgetPlan } from "@/lib/budget/types";
import { withPlanningWorkspace } from "@/lib/planning-hub/navigation";
import { buildPlanningHubHref } from "@/lib/planning-hub/search";
import type { PlanningHubSearchParams, PlanningHubVenueResults } from "@/lib/planning-hub/types";
import { PlanningHubVenueCard } from "./planning-hub-venue-card";

export function PlanningHubVenueResults({
  comparedVenueIds,
  plan,
  results,
  savedVenueIds,
  searchParams,
  onCompare,
  onOpen,
  onSave
}: {
  comparedVenueIds: Set<string>;
  plan: BudgetPlan;
  results: PlanningHubVenueResults;
  savedVenueIds: Set<string>;
  searchParams: PlanningHubSearchParams;
  onCompare: (venueId: string) => void;
  onOpen: (venueId: string) => void;
  onSave: (venueId: string) => void;
}) {
  const planItemsByVenue = new Map(
    plan.items
      .filter((item) => item.categoryId === "venue" && item.bookingStatus !== "cancelled" && item.listingId)
      .map((item) => [item.listingId!, item])
  );

  if (results.error) {
    return (
      <section className="rounded-3xl border border-[#e6b8a0] bg-[#fff4ed] p-8 text-center">
        <h2 className="font-display text-3xl font-semibold text-[#713817]">Venue search needs attention</h2>
        <p className="mt-3 text-sm leading-6 text-[#7c4b32]">{results.error}</p>
        <a className="focus-ring mt-5 inline-flex min-h-11 items-center rounded-full bg-[#713817] px-5 text-sm font-semibold text-white" href="#manual-venue">Add a venue manually</a>
      </section>
    );
  }

  if (results.venues.length === 0) {
    return (
      <section className="rounded-3xl border border-[#d9d0c3] bg-white p-8 text-center sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9c542d]">No exact match yet</p>
        <h2 className="mt-3 font-display text-4xl font-semibold text-[#173526]">Your venue can still belong in the plan.</h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[#625f57]">Widen a filter, browse every venue, or add a venue EverAft does not list yet.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="focus-ring inline-flex min-h-11 items-center rounded-full border border-[#173526] px-5 text-sm font-semibold text-[#173526]" href={withPlanningWorkspace("/planning-hub", searchParams.workspace)}>Clear filters</Link>
          <a className="focus-ring inline-flex min-h-11 items-center rounded-full bg-[#173526] px-5 text-sm font-semibold text-white" href="#manual-venue">Add manually</a>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Matching wedding venues">
      <h2 className="sr-only">Matching wedding venues</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        {results.venues.map((venue, index) => {
          const item = planItemsByVenue.get(venue.id);
          return (
            <PlanningHubVenueCard
              bookingStatus={item?.bookingStatus ?? null}
              chosen={plan.selectedVenueId === venue.id}
              compared={comparedVenueIds.has(venue.id)}
              key={venue.id}
              onCompare={() => onCompare(venue.id)}
              onOpen={() => onOpen(venue.id)}
              onSave={() => onSave(venue.id)}
              priority={index === 0}
              saved={savedVenueIds.has(venue.id)}
              venue={venue}
            />
          );
        })}
      </div>
      <nav aria-label="Venue result pages" className="mt-8 flex items-center justify-between gap-3">
        <PageLink disabled={results.page <= 1} href={buildPlanningHubHref({ ...searchParams, page: String(results.page - 1) })}>
          <ChevronLeft size={16} /> Previous
        </PageLink>
        <span className="text-xs font-medium text-[#625f57]">Page {results.page} of {results.totalPages}</span>
        <PageLink disabled={results.page >= results.totalPages} href={buildPlanningHubHref({ ...searchParams, page: String(results.page + 1) })}>
          Next <ChevronRight size={16} />
        </PageLink>
      </nav>
    </section>
  );
}

function PageLink({ children, disabled, href }: { children: ReactNode; disabled: boolean; href: string }) {
  return disabled
    ? <span className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-[#625f57]">{children}</span>
    : <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9d0c3] bg-white px-4 text-sm font-semibold text-[#173526]" href={href} scroll={false}>{children}</Link>;
}
