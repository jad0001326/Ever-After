import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { reviewSupplierCatalogueCandidates } from "@/app/actions/supplier-catalogue";
import { SupplierCatalogueImportForm } from "@/components/admin/supplier-catalogue-import-form";
import { Button, ButtonLink } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { supplierDirectoryCategories } from "@/data/supplier-directory";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const metadata: Metadata = { title: "Supplier catalogue staging" };
type Status = "staged" | "accepted" | "rejected" | "duplicate";
type Candidate = Database["public"]["Tables"]["supplier_catalogue_candidates"]["Row"];

export default async function SupplierStagingPage({ searchParams }: { searchParams: Promise<{ status?: string; category?: string; message?: string }> }) {
  await requireAdmin();
  const { status, category, message } = await searchParams;
  const selected: Status = status === "accepted" || status === "rejected" || status === "duplicate" ? status : "staged";
  const supabase = await createClient();
  let candidateQuery = supabase!.from("supplier_catalogue_candidates").select("*").eq("review_status", selected).order("created_at", { ascending: selected !== "staged" }).limit(100);
  if (category && supplierDirectoryCategories.some((item) => item.slug === category)) candidateQuery = candidateQuery.eq("category_slug", category);
  const [{ data, error }, { data: statusRows }, { data: batches }] = await Promise.all([
    candidateQuery,
    supabase!.from("supplier_catalogue_candidates").select("review_status"),
    supabase!.from("supplier_catalogue_batches").select("id, file_name, source_label, research_date, status, created_at").order("created_at", { ascending: false }).limit(20)
  ]);
  const candidates = (data ?? []) as Candidate[];
  const batchById = new Map((batches ?? []).map((batch) => [batch.id, batch]));
  const counts: Record<Status, number> = { staged: 0, accepted: 0, rejected: 0, duplicate: 0 };
  for (const row of statusRows ?? []) counts[row.review_status] += 1;
  const queryFor = (nextStatus: Status, nextCategory = category) => `/admin/supplier-staging?status=${nextStatus}${nextCategory ? `&category=${encodeURIComponent(nextCategory)}` : ""}`;

  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><Link className="text-sm font-semibold text-[#35533e]" href="/admin">Back to admin</Link><p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Source-backed acquisition</p><h1 className="mt-3 font-display text-5xl font-semibold">Supplier staging</h1><p className="mt-3 max-w-3xl text-[var(--muted)]">Validate research in batches, preserve provenance and permission state, then explicitly accept records as unpublished drafts.</p></div><ButtonLink href="/admin/suppliers" variant="secondary">Supplier profiles</ButtonLink></div>
    {message ? <p className="mt-6 rounded-2xl bg-[#eef4ea] px-4 py-3 text-sm text-[#285237]">{message}</p> : null}
    <div className="mt-8"><SupplierCatalogueImportForm defaultResearchDate={new Date().toISOString().slice(0, 10)} /></div>
    <section className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-6"><div className="flex items-start gap-3"><ShieldCheck className="mt-1 text-[#8b6d3c]" size={20} /><div><h2 className="font-display text-3xl font-semibold">Review boundary</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Acceptance creates draft profiles only. It cannot publish, feature, claim, contact, or activate a category. Unapproved imagery remains recorded here but is excluded from the draft.</p></div></div></section>
    <div className="mt-8 flex flex-wrap gap-2 text-sm font-semibold">{(["staged", "accepted", "rejected", "duplicate"] as Status[]).map((item) => <Link className={selected === item ? "rounded-full bg-[var(--brand)] px-4 py-2 text-white" : "rounded-full bg-white px-4 py-2 ring-1 ring-[var(--line)]"} href={queryFor(item)} key={item}>{item[0].toUpperCase() + item.slice(1)} ({counts[item]})</Link>)}</div>
    <div className="mt-4 flex flex-wrap gap-2">{supplierDirectoryCategories.map((item) => <Link className={category === item.slug ? "rounded-full bg-[#f0e5d4] px-3 py-1.5 text-xs font-semibold" : "rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-[var(--line)]"} href={queryFor(selected, item.slug)} key={item.slug}>{item.plural}</Link>)}</div>
    {error ? <p className="mt-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-red-700">{error.message}</p> : null}
    <form action={reviewSupplierCatalogueCandidates} className="mt-6">
      <div className="grid gap-4">
        {candidates.map((candidate) => {
          const batch = batchById.get(candidate.batch_id);
          return <article className="[content-visibility:auto] rounded-3xl border border-[var(--line)] bg-white p-5 [contain-intrinsic-size:auto_280px]" key={candidate.id}>
            <div className="flex items-start gap-4">{selected === "staged" ? <input aria-label={`Select ${candidate.business_name}`} className="mt-2 size-4 shrink-0 accent-[#334235]" name="candidateIds" type="checkbox" value={candidate.id} /> : null}<div className="min-w-0 flex-1"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-display text-2xl font-semibold">{candidate.business_name}</h2><p className="mt-1 text-sm text-[var(--muted)]">{candidate.category_slug} - {candidate.base_town}, {candidate.region}</p></div><a className="inline-flex items-center gap-2 text-sm font-semibold text-[#35533e]" href={candidate.source_url} rel="noreferrer" target="_blank">Source <ExternalLink size={14} /></a></div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><Fact label="Research" value={`${candidate.researched_at} - ${candidate.source_type}`} /><Fact label="Pricing" value={candidate.pricing_summary ?? (candidate.starting_price_pence == null ? "Not supplied" : `From GBP ${(candidate.starting_price_pence / 100).toFixed(2)}`)} /><Fact label="Image rights" value={candidate.image_permission_status} /><Fact label="Batch" value={batch?.source_label ?? candidate.batch_id} /></div>
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{candidate.summary}</p>
              {candidate.review_notes ? <p className="mt-3 rounded-2xl bg-[#fff9ef] px-4 py-3 text-sm text-[#715622]">{candidate.review_notes}</p> : null}
              {candidate.listing_id ? <Link className="mt-3 inline-flex text-sm font-semibold text-[#35533e]" href={`/admin/suppliers/${candidate.listing_id}/edit`}>Open created draft</Link> : null}
            </div></div>
          </article>;
        })}
        {!candidates.length && !error ? <div className="rounded-3xl border border-[var(--line)] bg-white p-10 text-center"><FileSpreadsheet className="mx-auto text-[#9d7b45]" size={28} /><h2 className="mt-4 font-display text-3xl font-semibold">No {selected} candidates</h2><p className="mt-2 text-sm text-[var(--muted)]">Stage a validated research batch or choose another status.</p></div> : null}
      </div>
      {selected === "staged" && candidates.length ? <div className="sticky bottom-4 mt-5 rounded-3xl border border-[#d9c7a8] bg-[#fffaf1] p-5 shadow-lg"><p className="text-sm font-semibold">Bulk review selected candidates</p><div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]"><Textarea className="min-h-24 bg-white" maxLength={2000} name="reviewNotes" placeholder="Required when rejecting or marking duplicates; optional for acceptance" /><div className="flex flex-wrap items-end gap-2"><Button name="decision" type="submit" value="accepted">Accept as drafts</Button><Button name="decision" type="submit" value="duplicate" variant="secondary">Mark duplicate</Button><Button name="decision" type="submit" value="rejected" variant="secondary">Reject</Button></div></div></div> : null}
    </form>
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-[#fbf8f3] p-3"><p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p><p className="mt-1 break-words font-medium">{value}</p></div>; }
