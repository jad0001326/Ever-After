import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { reviewSupplierCatalogueCandidates } from "@/app/actions/supplier-catalogue";
import { SupplierCatalogueImportForm } from "@/components/admin/supplier-catalogue-import-form";
import { Button, ButtonLink } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { supplierCategoryBySlug, supplierDirectoryCategories } from "@/data/supplier-directory";
import { requireAdmin } from "@/lib/auth";
import {
  buildSupplierStagingDirectoryHref,
  getSupplierStagingDirectoryPageCount,
  getSupplierStagingDirectoryRange,
  parseSupplierStagingDirectoryFilters,
  supplierStagingStatuses,
  type SupplierStagingStatus,
} from "@/lib/supplier-staging-directory";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const metadata: Metadata = { title: "Supplier catalogue staging" };

type Candidate = Database["public"]["Tables"]["supplier_catalogue_candidates"]["Row"];
type BatchSummary = Pick<Database["public"]["Tables"]["supplier_catalogue_batches"]["Row"], "id" | "source_label">;
type SearchParams = Promise<{
  category?: string;
  message?: string;
  page?: string;
  status?: string;
}>;

export default async function SupplierStagingPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const filters = parseSupplierStagingDirectoryFilters(params);
  const { from, to } = getSupplierStagingDirectoryRange(filters.page);
  const supabase = await createClient();
  if (!supabase) redirect("/admin/supplier-staging?message=Configure+Supabase+first");

  let candidateQuery = supabase
    .from("supplier_catalogue_candidates")
    .select(
      "id, batch_id, business_name, category_slug, base_town, region, source_url, researched_at, source_type, pricing_summary, starting_price_pence, image_permission_status, summary, review_notes, listing_id, created_at",
      { count: "exact" },
    )
    .eq("review_status", filters.status);
  if (filters.category) candidateQuery = candidateQuery.eq("category_slug", filters.category);
  candidateQuery = candidateQuery
    .order("created_at", { ascending: filters.status === "staged" })
    .order("id", { ascending: true })
    .range(from, to);

  const otherStatuses = supplierStagingStatuses.filter((status) => status !== filters.status);
  const countQueries = otherStatuses.map((status) => {
    let query = supabase
      .from("supplier_catalogue_candidates")
      .select("id", { count: "exact", head: true })
      .eq("review_status", status);
    if (filters.category) query = query.eq("category_slug", filters.category);
    return query;
  });
  const [candidateResult, ...countResults] = await Promise.all([candidateQuery, ...countQueries]);
  const candidates = (candidateResult.data ?? []) as Candidate[];
  const candidateTotal = candidateResult.count ?? 0;
  const pageCount = getSupplierStagingDirectoryPageCount(candidateTotal);
  if (!candidateResult.error && filters.page > pageCount) {
    redirect(buildSupplierStagingDirectoryHref(filters, { page: pageCount }));
  }

  const counts = { staged: 0, accepted: 0, rejected: 0, duplicate: 0 } satisfies Record<SupplierStagingStatus, number>;
  counts[filters.status] = candidateTotal;
  otherStatuses.forEach((status, index) => {
    counts[status] = countResults[index]?.count ?? 0;
  });

  const batchIds = Array.from(new Set(candidates.map((candidate) => candidate.batch_id)));
  const batchResult = batchIds.length
    ? await supabase.from("supplier_catalogue_batches").select("id, source_label").in("id", batchIds)
    : { data: [], error: null };
  const batches = (batchResult.data ?? []) as BatchSummary[];
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const queryError = candidateResult.error
    ?? countResults.find((result) => result.error)?.error
    ?? batchResult.error;
  const shownFrom = candidates.length ? from + 1 : 0;
  const shownTo = from + candidates.length;
  const activeCategory = filters.category ? supplierCategoryBySlug(filters.category) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[#35533e]" href="/admin">Back to admin</Link>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Source-backed acquisition</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">Supplier staging</h1>
          <p className="mt-3 max-w-3xl text-[var(--muted)]">Validate research in batches, preserve provenance and permission state, then explicitly accept records as unpublished drafts.</p>
        </div>
        <ButtonLink href="/admin/suppliers" variant="secondary">Supplier profiles</ButtonLink>
      </div>

      {params.message ? <p className="mt-6 rounded-2xl bg-[#eef4ea] px-4 py-3 text-sm text-[#285237]">{params.message}</p> : null}
      <div className="mt-8"><SupplierCatalogueImportForm defaultResearchDate={new Date().toISOString().slice(0, 10)} /></div>
      <section className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-6">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-1 text-[#8b6d3c]" size={20} /><div><h2 className="font-display text-3xl font-semibold">Review boundary</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Acceptance creates draft profiles only. It cannot publish, feature, claim, contact, or activate a category. Unapproved imagery remains recorded here but is excluded from the draft.</p></div></div>
      </section>

      <nav aria-label="Supplier staging status" className="mt-8 flex flex-wrap gap-2 text-sm font-semibold">
        {supplierStagingStatuses.map((status) => (
          <Link
            aria-current={filters.status === status ? "page" : undefined}
            className={filters.status === status ? "rounded-full bg-[var(--brand)] px-4 py-2 text-white" : "rounded-full bg-white px-4 py-2 ring-1 ring-[var(--line)]"}
            href={buildSupplierStagingDirectoryHref(filters, { page: 1, status })}
            key={status}
          >
            <span className="capitalize">{status}</span> ({counts[status]})
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-xs text-[var(--muted)]">Queue counts reflect {activeCategory ? `${activeCategory.plural} only` : "all supplier categories"}.</p>

      <nav aria-label="Supplier staging category" className="mt-4 flex flex-wrap gap-2">
        <CategoryLink
          active={!filters.category}
          href={buildSupplierStagingDirectoryHref(filters, { category: null, page: 1 })}
          label="All categories"
        />
        {supplierDirectoryCategories.map((category) => (
          <CategoryLink
            active={filters.category === category.slug}
            href={buildSupplierStagingDirectoryHref(filters, { category: category.slug, page: 1 })}
            key={category.slug}
            label={category.plural}
          />
        ))}
      </nav>

      {queryError ? <p className="mt-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-red-700">{queryError.message}</p> : null}
      <p aria-live="polite" className="mt-6 text-sm text-[var(--muted)]">
        Showing {shownFrom}–{shownTo} of {candidateTotal} {filters.status} candidate{candidateTotal === 1 ? "" : "s"}{activeCategory ? ` in ${activeCategory.plural}` : ""}.
      </p>

      <form action={reviewSupplierCatalogueCandidates} className="mt-4">
        <div className="grid gap-4">
          {candidates.map((candidate) => {
            const batch = batchById.get(candidate.batch_id);
            const category = supplierCategoryBySlug(candidate.category_slug);
            return (
              <article className="[content-visibility:auto] rounded-3xl border border-[var(--line)] bg-white p-5 [contain-intrinsic-size:auto_280px]" key={candidate.id}>
                <div className="flex items-start gap-4">
                  {filters.status === "staged" ? <input aria-label={`Select ${candidate.business_name}`} className="mt-2 size-4 shrink-0 accent-[#334235]" name="candidateIds" type="checkbox" value={candidate.id} /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div><h2 className="font-display text-2xl font-semibold">{candidate.business_name}</h2><p className="mt-1 text-sm text-[var(--muted)]">{category?.label ?? candidate.category_slug} · {candidate.base_town}, {candidate.region}</p></div>
                      <a className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#35533e]" href={candidate.source_url} rel="noreferrer" target="_blank">Source <ExternalLink size={14} /></a>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <Fact label="Research" value={`${candidate.researched_at} · ${candidate.source_type}`} />
                      <Fact label="Pricing" value={candidate.pricing_summary ?? (candidate.starting_price_pence == null ? "Not supplied" : `From GBP ${(candidate.starting_price_pence / 100).toFixed(2)}`)} />
                      <Fact label="Image rights" value={candidate.image_permission_status} />
                      <Fact label="Batch" value={batch?.source_label ?? candidate.batch_id} />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{candidate.summary}</p>
                    {candidate.review_notes ? <div className="mt-3 rounded-2xl bg-[#fff4df] px-4 py-3 text-sm text-[#715622]"><p className="font-semibold">{filters.status === "staged" ? "Manual resolution required before acceptance" : "Review record"}</p><p className="mt-1 whitespace-pre-line">{candidate.review_notes}</p></div> : null}
                    {candidate.listing_id ? <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#35533e]" href={`/admin/suppliers/${candidate.listing_id}/edit`}>Open created draft</Link> : null}
                  </div>
                </div>
              </article>
            );
          })}
          {!candidates.length && !queryError ? <div className="rounded-3xl border border-[var(--line)] bg-white p-10 text-center"><FileSpreadsheet className="mx-auto text-[#9d7b45]" size={28} /><h2 className="mt-4 font-display text-3xl font-semibold">No {filters.status} candidates</h2><p className="mt-2 text-sm text-[var(--muted)]">Stage a validated research batch or choose another status or category.</p></div> : null}
        </div>
        {filters.status === "staged" && candidates.length ? <div className="sticky bottom-4 mt-5 rounded-3xl border border-[#d9c7a8] bg-[#fffaf1] p-5 shadow-lg"><p className="text-sm font-semibold">Bulk review selected candidates on this page</p><div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]"><Textarea className="min-h-24 bg-white" maxLength={2000} name="reviewNotes" placeholder="Required for rejection, duplicates, or acceptance when a candidate has a manual review note" /><div className="flex flex-wrap items-end gap-2"><Button name="decision" type="submit" value="accepted">Accept as drafts</Button><Button name="decision" type="submit" value="duplicate" variant="secondary">Mark duplicate</Button><Button name="decision" type="submit" value="rejected" variant="secondary">Reject</Button></div></div></div> : null}
      </form>

      <nav aria-label="Supplier staging pages" className="mt-5 flex items-center justify-between gap-3">
        <PageLink disabled={filters.page <= 1} href={buildSupplierStagingDirectoryHref(filters, { page: filters.page - 1 })}>Previous</PageLink>
        <p className="text-center text-sm text-[var(--muted)]">Page {filters.page} of {pageCount}</p>
        <PageLink disabled={filters.page >= pageCount} href={buildSupplierStagingDirectoryHref(filters, { page: filters.page + 1 })}>Next</PageLink>
      </nav>
    </div>
  );
}

function CategoryLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return <Link aria-current={active ? "page" : undefined} className={active ? "rounded-full bg-[#f0e5d4] px-3 py-1.5 text-xs font-semibold" : "rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-[var(--line)]"} href={href}>{label}</Link>;
}

function PageLink({ children, disabled, href }: { children: React.ReactNode; disabled: boolean; href: string }) {
  return disabled
    ? <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-[#9a958d]">{children}</span>
    : <Link className="focus-ring inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#35533e] ring-1 ring-[var(--line)]" href={href}>{children}</Link>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-[#fbf8f3] p-3"><p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p><p className="mt-1 break-words font-medium">{value}</p></div>;
}
