import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { PhotographerFilterPanel } from "@/components/search/photographer-filter-panel";
import { PhotographerSortSelect } from "@/components/search/photographer-sort-select";
import { SupplierCard } from "@/components/supplier/supplier-card";
import { ButtonLink } from "@/components/ui/button";
import { buildBreadcrumbSchema, buildMetadata } from "@/lib/seo";
import { getPhotographerVenueOptions, searchPhotographerListings } from "@/lib/suppliers";
import type { PhotographerSearchParams } from "@/types/supplier";

export async function generateMetadata({ searchParams }: { searchParams: Promise<PhotographerSearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const metadata = buildMetadata({
    title: "Wedding Photographers in Scotland",
    description: "Find Scottish wedding photographers by location, photography style and package budget, with useful pricing and coverage details.",
    path: "/photographers",
    keywords: ["wedding photographers Scotland", "Scottish wedding photographer", "wedding photography Scotland"]
  });
  return Object.values(params).some(Boolean) ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function PhotographersPage({ searchParams }: { searchParams: Promise<PhotographerSearchParams> }) {
  const params = await searchParams;
  const [results, venues] = await Promise.all([searchPhotographerListings(params), getPhotographerVenueOptions()]);
  const selectedVenue = params.venue ? venues.find((venue) => venue.id === params.venue) ?? null : null;
  const breadcrumbSchema = buildBreadcrumbSchema([{ name: "Home", path: "/" }, { name: "Wedding photographers in Scotland", path: "/photographers" }]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} type="application/ld+json" />
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Supplier search</p>
          <h1 className="mt-3 max-w-4xl font-display text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">Wedding photographers in Scotland</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">Compare photographers by style, location, travel coverage and package price.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{results.total} {results.total === 1 ? "photographer" : "photographers"} matched your search.</p>
          {results.error ? <p className="mt-4 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19] ring-1 ring-[#f0c2a8]">The photographer directory is being prepared: {results.error}</p> : null}
        </div>
        <Suspense fallback={null}><PhotographerSortSelect /></Suspense>
      </div>

      <ActiveFilters params={params} selectedVenueName={selectedVenue?.name ?? null} />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Suspense fallback={null}><PhotographerFilterPanel venues={venues} /></Suspense>
        <section>
          {results.suppliers.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{results.suppliers.map((supplier, index) => <SupplierCard key={supplier.id} priority={index === 0} supplier={supplier} />)}</div> : <EmptyDirectory hasFilters={Object.values(params).some(Boolean)} />}
          {results.totalPages > 1 ? <div className="mt-8 flex items-center justify-between">
            <PaginationLink disabled={results.page <= 1} href={buildPhotographerHref({ ...params, page: String(results.page - 1) })}><ChevronLeft size={16} /> Previous</PaginationLink>
            <span className="text-sm text-[var(--muted)]">Page {results.page} of {results.totalPages}</span>
            <PaginationLink disabled={results.page >= results.totalPages} href={buildPhotographerHref({ ...params, page: String(results.page + 1) })}>Next <ChevronRight size={16} /></PaginationLink>
          </div> : null}
        </section>
      </div>
    </div>
  );
}

function EmptyDirectory({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-8 text-center sm:p-12">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">{hasFilters ? "No exact match yet" : "Founding photographers"}</p>
      <h2 className="mt-3 font-display text-4xl font-semibold">{hasFilters ? "Try widening your search" : "The first collection is being built now."}</h2>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">{hasFilters ? "Clear a location, style or budget filter to see more photographers." : "EverAft is reviewing Scottish photographers before profiles go public. Businesses can apply now for an early listing."}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">{hasFilters ? <ButtonLink href="/photographers" variant="secondary">Clear filters</ButtonLink> : null}<ButtonLink href="/for-business?category=Photographer">Apply as a photographer <ArrowRight size={16} /></ButtonLink></div>
    </div>
  );
}

function ActiveFilters({ params, selectedVenueName }: { params: PhotographerSearchParams; selectedVenueName: string | null }) {
  const budget = Number(params.budget);
  const filters = [selectedVenueName ? `Covers: ${selectedVenueName}` : null, params.location ? `Location: ${params.location}` : null, params.style ? `Style: ${params.style}` : null, params.budget && Number.isFinite(budget) ? `Packages up to £${budget.toLocaleString("en-GB")}` : null].filter((item): item is string => Boolean(item));
  if (!filters.length) return null;
  return <div className="mb-6 flex flex-wrap items-center gap-2">{filters.map((filter) => <span className="rounded-full bg-[#f4efe7] px-3 py-1 text-sm font-medium text-[#4f4a43]" key={filter}>{filter}</span>)}<Link className="rounded-full px-3 py-1 text-sm font-semibold text-[#5c6b52] transition hover:bg-white" href="/photographers">Clear all</Link></div>;
}

function buildPhotographerHref(params: PhotographerSearchParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); });
  return `/photographers${query.size ? `?${query.toString()}` : ""}`;
}

function PaginationLink({ children, disabled, href }: { children: ReactNode; disabled: boolean; href: string }) {
  return disabled ? <span className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-[#aaa195]">{children}</span> : <Link className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-[var(--line)] transition hover:bg-[#f7f1e8]" href={href}>{children}</Link>;
}
