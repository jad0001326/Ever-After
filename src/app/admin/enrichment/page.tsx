import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, ShieldCheck } from "lucide-react";
import { batchApproveSafeEnrichmentProposals } from "@/app/actions/enrichment";
import {
  EnrichmentMetric,
  EnrichmentRecordLink,
  EnrichmentSetupBanner,
  EnrichmentStatus,
  EnrichmentTags,
  formatEnrichmentDate,
  formatEnrichmentLabel,
  safeEnrichmentUrl
} from "@/components/admin/enrichment-ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { enrichmentBusinessName, firstValidBusinessEmail, selectPrimaryEmailCheck } from "@/lib/enrichment/review-display";
import { isSafeBatchEnrichmentProposal } from "@/lib/enrichment/review-policy";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Enrichment review" };

type SearchParams = {
  q?: string;
  status?: string;
  blocker?: string;
  confidence?: string;
  email?: string;
  pricing?: string;
  business?: string;
  run?: string;
  page?: string;
  message?: string;
};

type Row = Record<string, unknown>;

type ReviewRecord = {
  id: string;
  entityId: string;
  entityType: string;
  businessName: string;
  eligibleBefore: boolean;
  eligibleAfter: boolean;
  eligibilityBlockers: string[];
  qualityBlockers: string[];
  missingFields: string[];
  businessStatus: string;
  researchStatus: string;
  requiresManualReview: boolean;
  createdAt: string | null;
  emailStatus: string;
  email: string;
  pricingStatus: string;
  confidences: string[];
  sourceLinks: Array<{ title: string; url: string }>;
  safeProposals: Array<{ id: string; field: string }>;
  duplicate: boolean;
  suppressed: boolean;
  optedOut: boolean;
};

const pageSize = 25;

export default async function AdminEnrichmentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params] = await Promise.all([searchParams, requireAdmin()]);
  const client = createAdminClient();

  if (!client) {
    return <PageShell message={params.message}><EnrichmentSetupBanner message="SUPABASE_SERVICE_ROLE_KEY is not configured for this deployment." /></PageShell>;
  }

  const database = client as unknown as SupabaseClient;
  const runsResult = await database.from("enrichment_runs").select("*").eq("mode", "review").order("created_at", { ascending: false }).limit(50);
  if (runsResult.error) {
    return <PageShell message={params.message}><EnrichmentSetupBanner message={`The enrichment workflow is not available yet: ${runsResult.error.message}`} /></PageShell>;
  }
  const runs = rows(runsResult.data);
  const latestCompletedRun = runs.find((run) => text(run.status) === "completed");
  const requestedRun = params.run ? runs.find((run) => text(run.id) === params.run) : undefined;
  const selectedRun = requestedRun ?? latestCompletedRun ?? runs[0];
  if (!selectedRun) {
    return <PageShell message={params.message}><EnrichmentSetupBanner message="No staged enrichment review run is available yet." /></PageShell>;
  }
  const selectedRunId = text(selectedRun.id);
  const isCurrentRun = text(latestCompletedRun?.id) === selectedRunId && text(selectedRun.status) === "completed";

  const [recordsResult, proposalsResult, emailChecksResult, duplicatesResult, profilesResult] = await Promise.all([
    database.from("enrichment_records").select("*").eq("run_id", selectedRunId).order("created_at", { ascending: false }).limit(5_000),
    database.from("enrichment_field_proposals").select("*, enrichment_records!inner(run_id)").eq("enrichment_records.run_id", selectedRunId).order("updated_at", { ascending: false }).limit(10_000),
    database.from("enrichment_email_checks").select("*, enrichment_records!inner(run_id)").eq("enrichment_records.run_id", selectedRunId).order("checked_at", { ascending: false }).limit(10_000),
    database.from("enrichment_duplicate_candidates").select("*").eq("run_id", selectedRunId).limit(5_000),
    database.from("business_enrichment_profiles").select("*").limit(5_000)
  ]);
  const loadError = [recordsResult.error, proposalsResult.error, emailChecksResult.error, duplicatesResult.error, profilesResult.error].find(Boolean);
  if (loadError) {
    return <PageShell message={params.message}><EnrichmentSetupBanner message={`The enrichment workflow is not available yet: ${loadError.message}`} /></PageShell>;
  }

  const records = rows(recordsResult.data);
  const proposals = rows(proposalsResult.data);
  const emailChecks = rows(emailChecksResult.data);
  const duplicates = rows(duplicatesResult.data);
  const profiles = rows(profilesResult.data);
  const reviewRecords = buildReviewRecords(records, proposals, emailChecks, duplicates, profiles);
  const summary = summarize(reviewRecords);
  const filtered = filterRecords(reviewRecords, params);
  const page = clampPage(params.page, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selectedParams = { ...params, run: selectedRunId };

  async function batchApproveCurrentRun(formData: FormData) {
    "use server";
    await requireAdmin();
    const currentClient = createAdminClient();
    if (!currentClient) redirect(`/admin/enrichment?run=${encodeURIComponent(selectedRunId)}&message=Configure+SUPABASE_SERVICE_ROLE_KEY+before+reviewing+enrichment+records`);
    const currentDatabase = currentClient as unknown as SupabaseClient;
    const proposalIds = Array.from(new Set(formData.getAll("proposalIds").map((value) => value.toString()).filter(Boolean))).slice(0, 100);
    const [currentRunResult, scopedProposalsResult] = await Promise.all([
      currentDatabase.from("enrichment_runs").select("id").eq("mode", "review").eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      proposalIds.length > 0
        ? currentDatabase.from("enrichment_field_proposals").select("id, enrichment_records!inner(run_id)").in("id", proposalIds).eq("enrichment_records.run_id", selectedRunId)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (currentRunResult.error || scopedProposalsResult.error) {
      const message = currentRunResult.error?.message ?? scopedProposalsResult.error?.message ?? "The selected run could not be verified.";
      redirect(`/admin/enrichment?run=${encodeURIComponent(selectedRunId)}&message=${encodeURIComponent(message)}`);
    }
    if (text(currentRunResult.data?.id) !== selectedRunId) {
      redirect(`/admin/enrichment?run=${encodeURIComponent(selectedRunId)}&message=This+is+not+the+current+completed+run.+Review+it+read-only+or+switch+to+the+latest+run`);
    }
    if (rows(scopedProposalsResult.data).length !== proposalIds.length) {
      redirect(`/admin/enrichment?run=${encodeURIComponent(selectedRunId)}&message=Every+batch+proposal+must+belong+to+the+selected+run`);
    }
    await batchApproveSafeEnrichmentProposals(formData);
  }

  return (
    <PageShell message={params.message}>
      <RunSelector currentRunId={text(latestCompletedRun?.id)} runs={runs} selectedRun={selectedRun} />
      {params.run && !requestedRun ? <p className="mb-6 rounded-2xl bg-[#fff9ef] px-4 py-3 text-sm text-[#715622] ring-1 ring-[#e5d5b7]">The requested run was not found. Showing the latest available completed run.</p> : null}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <EnrichmentMetric label="Total records" value={summary.total} />
        <EnrichmentMetric href={runHref(selectedRunId, { blocker: "currently_eligible" })} label="Currently eligible" tone="success" value={summary.currentlyEligible} />
        <EnrichmentMetric href={runHref(selectedRunId, { blocker: "newly_eligible" })} label="Projected newly eligible" tone="success" value={summary.newlyEligible} />
        <EnrichmentMetric href={runHref(selectedRunId, { blocker: "missing_email" })} label="Missing email" tone="warning" value={summary.missingEmail} />
        <EnrichmentMetric href={runHref(selectedRunId, { email: "invalid" })} label="Invalid email" tone="danger" value={summary.invalidEmail} />
        <EnrichmentMetric href={runHref(selectedRunId, { email: "unverified" })} label="Unverified email" tone="warning" value={summary.unverifiedEmail} />
        <EnrichmentMetric href={runHref(selectedRunId, { blocker: "missing_website" })} label="Missing website" tone="warning" value={summary.missingWebsite} />
        <EnrichmentMetric href={runHref(selectedRunId, { blocker: "missing_price" })} label="Missing price" tone="warning" value={summary.missingPrice} />
        <EnrichmentMetric href={runHref(selectedRunId, { pricing: "contact_for_price" })} label="Contact for price" value={summary.contactForPrice} />
        <EnrichmentMetric href={runHref(selectedRunId, { blocker: "duplicate" })} label="Duplicate warning" tone="warning" value={summary.duplicate} />
        <EnrichmentMetric href={runHref(selectedRunId, { business: "closed" })} label="Closed" tone="danger" value={summary.closed} />
        <EnrichmentMetric href={runHref(selectedRunId, { email: "suppressed" })} label="Suppressed" tone="danger" value={summary.suppressed} />
        <EnrichmentMetric href={runHref(selectedRunId, { email: "opted_out" })} label="Opted out" tone="danger" value={summary.optedOut} />
        <EnrichmentMetric href={runHref(selectedRunId, { status: "manual_review" })} label="Manual review" tone="warning" value={summary.manualReview} />
      </section>

      <ReviewFilters params={selectedParams} />

      <form action={batchApproveCurrentRun} className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
        <div className="flex flex-col gap-4 border-b border-[var(--line)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-semibold">{filtered.length} matching record{filtered.length === 1 ? "" : "s"}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Eligibility blockers mirror the send rules. Quality blockers remain visible but do not silently become send requirements.</p>
          </div>
          <div className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
              <input className="mt-0.5 size-4 shrink-0 accent-[#24432f]" disabled={!isCurrentRun} name="approvalConfirmed" type="checkbox" />
              {isCurrentRun ? "Confirm high-confidence, non-sensitive proposals selected below." : "Historical runs are read-only; switch to the current completed run to batch approve."}
            </label>
            <Button disabled={!isCurrentRun} type="submit" variant="secondary">Approve safe proposals</Button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--line)] px-5 py-4 text-sm font-semibold text-[#5a5248] lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
          <span>Business</span><span className="hidden lg:block">Eligibility</span><span className="hidden lg:block">Quality</span><span className="hidden lg:block">Evidence</span><span>Action</span>
        </div>
        {visible.map((record) => <ReviewRow allowBatchApproval={isCurrentRun} key={record.id} record={record} />)}
        {visible.length === 0 ? <p className="px-5 py-10 text-sm text-[var(--muted)]">No enrichment records match these filters.</p> : null}

        <Pagination current={page} params={selectedParams} total={Math.max(1, Math.ceil(filtered.length / pageSize))} />
      </form>
    </PageShell>
  );
}

function PageShell({ children, message }: { children: React.ReactNode; message?: string }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="text-sm font-semibold text-[#35533e]" href="/admin">Back to admin</Link>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin enrichment</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">Research review</h1>
          <p className="mt-3 max-w-3xl text-[var(--muted)]">Review sourced changes, verification results and outreach blockers before anything is applied to a live business record.</p>
        </div>
        <ButtonLink href="/admin/outreach" variant="secondary"><ShieldCheck size={17} /> Outreach campaigns</ButtonLink>
      </div>
      {message ? <p className="mb-6 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f594f] ring-1 ring-[var(--line)]">{message}</p> : null}
      {children}
    </div>
  );
}

function RunSelector({ currentRunId, runs, selectedRun }: { currentRunId: string; runs: Row[]; selectedRun: Row }) {
  const selectedRunId = text(selectedRun.id);
  const isCurrent = selectedRunId === currentRunId;
  const fingerprint = text(selectedRun.source_fingerprint);
  return (
    <section className="mb-6 rounded-3xl border border-[var(--line)] bg-white p-5">
      <form className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium text-[#4a443c]">
          Review run
          <select className="focus-ring h-11 w-full rounded-full border border-[var(--line)] bg-white px-4 text-sm" defaultValue={selectedRunId} name="run">
            {runs.map((run) => {
              const runId = text(run.id);
              const status = formatEnrichmentLabel(text(run.status) || "unknown");
              return <option key={runId} value={runId}>{formatEnrichmentDate(nullableText(run.completed_at) ?? nullableText(run.created_at))} · {status}{runId === currentRunId ? " · Current" : ""}</option>;
            })}
          </select>
        </label>
        <Button type="submit" variant="secondary">Load run</Button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        <EnrichmentStatus tone={isCurrent ? "success" : "warning"}>{isCurrent ? "Current completed run" : "Historical read-only run"}</EnrichmentStatus>
        <span>Created {formatEnrichmentDate(nullableText(selectedRun.created_at))}</span>
        {fingerprint ? <span title={fingerprint}>Fingerprint {fingerprint.slice(0, 12)}…</span> : null}
      </div>
    </section>
  );
}

function ReviewFilters({ params }: { params: SearchParams }) {
  return (
    <form className="mb-6 rounded-3xl border border-[var(--line)] bg-white p-5">
      <input name="run" type="hidden" value={params.run ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <label className="grid gap-2 text-sm font-medium text-[#4a443c] xl:col-span-2">Search<div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9a9286]" size={16} /><input className="focus-ring h-11 w-full rounded-full border border-[var(--line)] bg-white pl-10 pr-4 text-sm" defaultValue={params.q ?? ""} name="q" placeholder="Business or email" /></div></label>
        <FilterSelect label="Research" name="status" value={params.status} options={["", "pending", "processing", "researched", "verified", "manual_review", "failed", "skipped"]} />
        <FilterSelect label="Blocker" name="blocker" value={params.blocker} options={["", "missing_email", "missing_website", "missing_price", "duplicate", "currently_eligible", "newly_eligible", "suppressed"]} />
        <FilterSelect label="Confidence" name="confidence" value={params.confidence} options={["", "high", "medium", "low"]} />
        <FilterSelect label="Email" name="email" value={params.email} options={["", "verified", "likely_valid", "unverified", "invalid", "hard_bounce", "suppressed", "opted_out", "not_found"]} />
        <FilterSelect label="Pricing" name="pricing" value={params.pricing} options={["", "published", "contact_for_price", "not_found"]} />
        <FilterSelect label="Business" name="business" value={params.business} options={["", "active", "likely_active", "temporarily_closed", "closed", "rebranded", "duplicate", "uncertain"]} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><Button type="submit" variant="secondary">Apply filters</Button><ButtonLink href={runHref(params.run ?? "", {})} variant="secondary">Clear filters</ButtonLink></div>
    </form>
  );
}

function FilterSelect({ label, name, options, value }: { label: string; name: string; options: string[]; value?: string }) {
  return <label className="grid gap-2 text-sm font-medium text-[#4a443c]">{label}<select className="focus-ring h-11 rounded-full border border-[var(--line)] bg-white px-4 text-sm" defaultValue={value ?? ""} name={name}>{options.map((option) => <option key={option || "all"} value={option}>{option ? formatEnrichmentLabel(option) : `All ${label.toLowerCase()}`}</option>)}</select></label>;
}

function ReviewRow({ allowBatchApproval, record }: { allowBatchApproval: boolean; record: ReviewRecord }) {
  return (
    <article className="grid grid-cols-[1fr_auto] items-start gap-4 border-b border-[var(--line)] px-5 py-5 last:border-b-0 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{record.businessName}</h2><EnrichmentStatus tone={record.researchStatus === "verified" ? "success" : record.requiresManualReview ? "warning" : "neutral"}>{formatEnrichmentLabel(record.researchStatus)}</EnrichmentStatus></div>
        <p className="mt-1 text-xs text-[var(--muted)]">{formatEnrichmentLabel(record.entityType)} · Last checked {formatEnrichmentDate(record.createdAt)}</p>
        {record.email ? <p className="mt-2 break-all text-xs text-[var(--muted)]">{record.email} · {formatEnrichmentLabel(record.emailStatus)}</p> : null}
        {allowBatchApproval && record.safeProposals.length > 0 ? <div className="mt-3 grid gap-2">{record.safeProposals.map((proposal) => <label className="flex items-center gap-2 text-xs text-[#4a443c]" key={proposal.id}><input className="size-4 accent-[#24432f]" name="proposalIds" type="checkbox" value={proposal.id} />Approve {formatEnrichmentLabel(proposal.field)}</label>)}</div> : null}
        {!allowBatchApproval && record.safeProposals.length > 0 ? <p className="mt-3 text-xs text-[var(--muted)]">{record.safeProposals.length} batch-safe proposal{record.safeProposals.length === 1 ? "" : "s"} shown read-only.</p> : null}
      </div>
      <div className="hidden lg:block"><EnrichmentStatus tone={record.eligibleBefore ? "success" : record.eligibleAfter ? "info" : "warning"}>{record.eligibleBefore ? "Currently eligible" : record.eligibleAfter ? "Eligible after review" : "Blocked"}</EnrichmentStatus><div className="mt-3"><EnrichmentTags values={record.eligibilityBlockers} tone="danger" /></div></div>
      <div className="hidden lg:block"><EnrichmentTags values={[...record.qualityBlockers, ...record.missingFields]} tone="warning" /></div>
      <div className="hidden text-xs leading-5 lg:block">{record.sourceLinks.map((source) => <a className="block truncate font-semibold text-[#5c6b52] underline underline-offset-2" href={source.url} key={source.url} rel="noreferrer" target="_blank">{source.title}</a>)}{record.sourceLinks.length === 0 ? <span className="text-[var(--muted)]">No source attached</span> : null}</div>
      <EnrichmentRecordLink href={`/admin/enrichment/${record.id}`} />
    </article>
  );
}

function Pagination({ current, params, total }: { current: number; params: SearchParams; total: number }) {
  if (total <= 1) return null;
  const query = new URLSearchParams(Object.entries(params).filter(([key, value]) => key !== "message" && key !== "page" && Boolean(value)) as [string, string][]);
  const href = (page: number) => { const next = new URLSearchParams(query); next.set("page", String(page)); return `/admin/enrichment?${next.toString()}`; };
  return <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] px-5 py-4 text-sm"><span className="text-[var(--muted)]">Page {current} of {total}</span><div className="flex gap-3">{current > 1 ? <ButtonLink href={href(current - 1)} variant="secondary">Previous</ButtonLink> : null}{current < total ? <ButtonLink href={href(current + 1)} variant="secondary">Next</ButtonLink> : null}</div></div>;
}

function buildReviewRecords(records: Row[], proposals: Row[], emailChecks: Row[], duplicates: Row[], profiles: Row[]): ReviewRecord[] {
  const proposalsByRecord = groupBy(proposals, "enrichment_record_id");
  const checksByRecord = groupBy(emailChecks, "enrichment_record_id");
  const profilesByEntity = new Map(profiles.map((profile) => [entityKey(text(profile.entity_type), text(profile.entity_id)), profile]));
  return records.map((record) => {
    const recordProposals = proposalsByRecord.get(text(record.id)) ?? [];
    const checks = checksByRecord.get(text(record.id)) ?? [];
    const profile = profilesByEntity.get(entityKey(text(record.entity_type), text(record.entity_id)));
    const snapshot = object(record.entity_snapshot);
    const proposedEmail = recordProposals.find((proposal) => text(proposal.target_field) === "vendor_contact_email")?.proposed_value;
    const preferredEmails = [snapshot.vendor_contact_email, snapshot.publicEmail, snapshot.email, proposedEmail, profile?.wedding_email, profile?.enquiries_email, profile?.sales_email, profile?.public_email];
    const emailCheck = selectPrimaryEmailCheck(checks, preferredEmails);
    const email = text(emailCheck?.email) || firstValidBusinessEmail(...preferredEmails);
    const emailStatus = text(emailCheck?.status) || (email ? "unverified" : "not_found");
    const entityId = text(record.entity_id);
    const entityType = text(record.entity_type) || "venue";
    const duplicate = duplicates.some((candidate) => (text(candidate.left_entity_id) === entityId || text(candidate.right_entity_id) === entityId) && text(candidate.status) !== "not_duplicate");
    const pricingStatus = pricingStatusFor(record, recordProposals, profile);
    const sourceLinks = uniqueSources(recordProposals).slice(0, 3);
    const requiresManualReview = bool(record.requires_manual_review);
    return {
      id: text(record.id), entityId, entityType,
      businessName: enrichmentBusinessName(snapshot, profile) || "Unnamed business",
      eligibleBefore: bool(record.before_outreach_eligible), eligibleAfter: bool(record.after_outreach_eligible),
      eligibilityBlockers: strings(record.eligibility_blockers), qualityBlockers: strings(record.quality_blockers), missingFields: strings(record.missing_fields),
      businessStatus: text(record.business_status) || text(profile?.business_status) || "uncertain", researchStatus: text(record.research_status) || "pending",
      requiresManualReview, createdAt: nullableText(record.created_at), emailStatus, email, pricingStatus,
      confidences: Array.from(new Set(recordProposals.map((proposal) => text(proposal.confidence)).filter(Boolean))), sourceLinks,
      safeProposals: recordProposals.filter((proposal) => isSafeBatchEnrichmentProposal({ confidence: text(proposal.confidence), status: text(proposal.status), targetField: text(proposal.target_field) })).map((proposal) => ({ id: text(proposal.id), field: text(proposal.target_field) })),
      duplicate, suppressed: emailStatus === "suppressed" || strings(record.eligibility_blockers).includes("suppressed"), optedOut: emailStatus === "opted_out"
    };
  });
}

function filterRecords(records: ReviewRecord[], params: SearchParams) {
  const query = params.q?.trim().toLowerCase();
  return records.filter((record) => {
    if (query && !`${record.businessName} ${record.email} ${record.entityType}`.toLowerCase().includes(query)) return false;
    if (params.status && record.researchStatus !== params.status) return false;
    if (params.confidence && !record.confidences.includes(params.confidence)) return false;
    if (params.email && record.emailStatus !== params.email) return false;
    if (params.pricing && record.pricingStatus !== params.pricing) return false;
    if (params.business && record.businessStatus !== params.business) return false;
    if (params.blocker === "currently_eligible" && !record.eligibleBefore) return false;
    if (params.blocker === "newly_eligible" && (record.eligibleBefore || !record.eligibleAfter)) return false;
    if (params.blocker === "duplicate" && !record.duplicate) return false;
    if (params.blocker && !["currently_eligible", "newly_eligible", "duplicate"].includes(params.blocker) && ![...record.eligibilityBlockers, ...record.qualityBlockers, ...record.missingFields].includes(params.blocker)) return false;
    return true;
  });
}

function summarize(records: ReviewRecord[]) {
  return {
    total: records.length, currentlyEligible: records.filter((record) => record.eligibleBefore).length,
    newlyEligible: records.filter((record) => !record.eligibleBefore && record.eligibleAfter).length,
    missingEmail: records.filter((record) => record.eligibilityBlockers.includes("missing_email") || record.missingFields.includes("email")).length,
    invalidEmail: records.filter((record) => record.emailStatus === "invalid" || record.eligibilityBlockers.includes("invalid_email")).length,
    unverifiedEmail: records.filter((record) => record.emailStatus === "unverified" || record.eligibilityBlockers.includes("unverified_contact")).length,
    missingWebsite: records.filter((record) => record.qualityBlockers.includes("missing_website") || record.missingFields.includes("website")).length,
    missingPrice: records.filter((record) => record.qualityBlockers.includes("missing_price") || record.missingFields.includes("price")).length,
    contactForPrice: records.filter((record) => record.pricingStatus === "contact_for_price").length,
    duplicate: records.filter((record) => record.duplicate).length, closed: records.filter((record) => record.businessStatus === "closed").length,
    suppressed: records.filter((record) => record.suppressed).length, optedOut: records.filter((record) => record.optedOut).length,
    manualReview: records.filter((record) => record.requiresManualReview || record.researchStatus === "manual_review").length
  };
}

function pricingStatusFor(record: Row, proposals: Row[], profile?: Row) {
  const structured = object(profile?.structured_pricing);
  const status = text(structured.pricingStatus) || text(structured.status);
  if (status) return status;
  const pricingProposal = proposals.find((proposal) => ["structured_pricing", "pricing_status", "price_from", "price_to"].includes(text(proposal.target_field)));
  const proposedPricing = object(pricingProposal?.proposed_value);
  const proposedStatus = text(proposedPricing.pricingStatus) || text(proposedPricing.status);
  if (proposedStatus) return proposedStatus;
  if (pricingProposal && ["price_from", "price_to"].includes(text(pricingProposal.target_field)) && pricingProposal.proposed_value != null) return "published";
  if (text(pricingProposal?.proposed_value).includes("contact_for_price")) return "contact_for_price";
  return strings(record.quality_blockers).includes("missing_price") ? "not_found" : "published";
}

function uniqueSources(proposals: Row[]) {
  const sources = new Map<string, { title: string; url: string }>();
  for (const proposal of proposals) { const url = safeEnrichmentUrl(text(proposal.source_url)); if (url && !sources.has(url)) sources.set(url, { url, title: text(proposal.source_title) || "View source" }); }
  return Array.from(sources.values());
}

function groupBy(items: Row[], key: string) { const grouped = new Map<string, Row[]>(); for (const item of items) { const value = text(item[key]); if (!value) continue; grouped.set(value, [...(grouped.get(value) ?? []), item]); } return grouped; }
function entityKey(type: string, id: string) { return `${type}:${id}`; }
function runHref(runId: string, values: Record<string, string>) { const query = new URLSearchParams({ run: runId, ...values }); return `/admin/enrichment?${query.toString()}`; }
function rows(value: unknown): Row[] { return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : []; }
function object(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function strings(value: unknown): string[] { if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string"); return []; }
function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function nullableText(value: unknown) { const valueText = text(value); return valueText || null; }
function bool(value: unknown) { return value === true; }
function clampPage(value: string | undefined, total: number) { const parsed = Number(value); return Math.min(Math.max(Number.isInteger(parsed) && parsed > 0 ? parsed : 1, 1), Math.max(total, 1)); }
