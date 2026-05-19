import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FilterPanel } from "@/components/search/filter-panel";
import { SortSelect } from "@/components/search/sort-select";
import { VenueCard } from "@/components/venue/venue-card";
import { buildVenueHref } from "@/lib/search";
import { searchVenueListings } from "@/lib/venues";
import type { VenueSearchParams } from "@/types/venue";

export const metadata: Metadata = {
  title: "Search wedding venues",
  description: "Search premium Scottish wedding venues by location, guest count, budget, and venue type."
};

export default async function VenuesPage({ searchParams }: { searchParams: Promise<VenueSearchParams> }) {
  const params = await searchParams;
  const results = await searchVenueListings(params);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Venue search</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">Wedding venues in Scotland</h1>
          <p className="mt-3 text-[var(--muted)]">{results.total} venues matched your search.</p>
          {results.error ? <p className="mt-4 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19] ring-1 ring-[#f0c2a8]">Supabase connection needed: {results.error}</p> : null}
        </div>
        <Suspense fallback={null}>
          <SortSelect />
        </Suspense>
      </div>

      <ActiveFilterSummary params={params} />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Suspense fallback={null}>
          <FilterPanel />
        </Suspense>
        <section>
          {results.venues.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.venues.map((venue, index) => (
                <VenueCard key={venue.id} priority={index === 0} venue={venue} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-[var(--line)] bg-white p-10 text-center">
              <h2 className="font-display text-3xl font-semibold">No venues found</h2>
              <p className="mt-3 text-[var(--muted)]">Try widening your guest count, budget, location, or venue type.</p>
              <Link className="mt-5 inline-flex text-sm font-semibold text-[#5c6b52]" href="/venues">Clear all filters</Link>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <PaginationLink disabled={results.page <= 1} href={buildVenueHref({ ...params, page: String(results.page - 1) })}>
              <ChevronLeft size={16} /> Previous
            </PaginationLink>
            <span className="text-sm text-[var(--muted)]">
              Page {results.page} of {results.totalPages}
            </span>
            <PaginationLink
              disabled={results.page >= results.totalPages}
              href={buildVenueHref({ ...params, page: String(results.page + 1) })}
            >
              Next <ChevronRight size={16} />
            </PaginationLink>
          </div>
        </section>
      </div>
    </div>
  );
}

function ActiveFilterSummary({ params }: { params: VenueSearchParams }) {
  const budget = Number(params.budget);
  const filters = [
    params.location ? `Location: ${params.location}` : null,
    params.guests ? `${params.guests} guests` : null,
    params.budget && Number.isFinite(budget) ? `Budget up to £${budget.toLocaleString("en-GB")}` : null,
    params.type ? `Style: ${params.type}` : null
  ].filter((item): item is string => Boolean(item));

  if (filters.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <span className="rounded-full bg-[#f4efe7] px-3 py-1 text-sm font-medium text-[#4f4a43]" key={filter}>
          {filter}
        </span>
      ))}
      <Link className="rounded-full px-3 py-1 text-sm font-semibold text-[#5c6b52] transition hover:bg-white" href="/venues">
        Clear all
      </Link>
    </div>
  );
}

function PaginationLink({ children, disabled, href }: { children: ReactNode; disabled: boolean; href: string }) {
  if (disabled) {
    return <span className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-[#aaa195]">{children}</span>;
  }

  return (
    <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-[var(--line)] transition hover:bg-[#f7f1e8]" href={href}>
      {children}
    </Link>
  );
}
