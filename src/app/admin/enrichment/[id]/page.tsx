import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, History, RotateCcw, SearchCheck } from "lucide-react";
import {
  applyEnrichmentProposal,
  approveEnrichmentProposal,
  editEnrichmentProposal,
  markEnrichmentForManualResearch,
  rejectEnrichmentProposal,
  requeueEnrichmentVerification,
  rollbackEnrichmentChange
} from "@/app/actions/enrichment";
import {
  EnrichmentSetupBanner,
  EnrichmentStatus,
  EnrichmentTags,
  formatEnrichmentDate,
  formatEnrichmentLabel,
  safeEnrichmentUrl
} from "@/components/admin/enrichment-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth";
import { enrichmentBusinessName } from "@/lib/enrichment/review-display";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Review enrichment record" };

type Row = Record<string, unknown>;

export default async function AdminEnrichmentRecordPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  await requireAdmin();
  const [{ id }, { message }] = await Promise.all([params, searchParams]);
  const client = createAdminClient();
  if (!client) return <DetailShell><EnrichmentSetupBanner message="SUPABASE_SERVICE_ROLE_KEY is not configured for this deployment." /></DetailShell>;
  const database = client as unknown as SupabaseClient;
  const recordResult = await database.from("enrichment_records").select("*").eq("id", id).maybeSingle();
  if (recordResult.error) return <DetailShell><EnrichmentSetupBanner message={`The enrichment workflow is not available yet: ${recordResult.error.message}`} /></DetailShell>;
  if (!recordResult.data) notFound();
  const record = recordResult.data as Row;
  const entityType = text(record.entity_type);
  const entityId = text(record.entity_id);

  const [proposalsResult, emailChecksResult, duplicatesResult, profileResult, changesResult, outreachResult] = await Promise.all([
    database.from("enrichment_field_proposals").select("*").eq("enrichment_record_id", id).order("created_at", { ascending: true }),
    database.from("enrichment_email_checks").select("*").eq("enrichment_record_id", id).order("checked_at", { ascending: false }),
    database.from("enrichment_duplicate_candidates").select("*").eq("run_id", text(record.run_id)).order("match_score", { ascending: false }),
    database.from("business_enrichment_profiles").select("*").eq("entity_type", entityType).eq("entity_id", entityId).maybeSingle(),
    database.from("enrichment_change_log").select("*").eq("enrichment_record_id", id).order("created_at", { ascending: false }),
    entityType === "venue"
      ? database.from("outreach_campaign_recipients").select("id, campaign_id, email, status, sent_at, delivered_at, error_message, created_at").eq("venue_id", entityId).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null })
  ]);
  const loadError = [proposalsResult.error, emailChecksResult.error, duplicatesResult.error, profileResult.error, changesResult.error, outreachResult.error].find(Boolean);
  if (loadError) return <DetailShell><EnrichmentSetupBanner message={`The record could not be loaded safely: ${loadError.message}`} /></DetailShell>;

  const proposals = rows(proposalsResult.data);
  const emailChecks = rows(emailChecksResult.data);
  const duplicates = rows(duplicatesResult.data).filter((candidate) =>
    (text(candidate.left_entity_type) === entityType && text(candidate.left_entity_id) === entityId) ||
    (text(candidate.right_entity_type) === entityType && text(candidate.right_entity_id) === entityId)
  );
  const profile = profileResult.data as Row | null;
  const changes = rows(changesResult.data);
  const outreach = rows(outreachResult.data);
  const snapshot = object(record.entity_snapshot);
  const businessName = enrichmentBusinessName(snapshot, profile) || `${formatEnrichmentLabel(entityType)} record`;
  const researchStatus = text(record.research_status) || "pending";
  const currentBusinessStatus = text(profile?.business_status) || text(record.business_status) || "uncertain";
  const eligibilityBlockers = strings(record.eligibility_blockers);
  const isCurrentlyEligible = bool(record.before_outreach_eligible);
  const isEligibleAfterChanges = bool(record.after_outreach_eligible);
  const isWaitingForNextCampaign = eligibilityBlockers.length === 1 && eligibilityBlockers[0] === "over_campaign_limit";
  const eligibilityLabel = isCurrentlyEligible
    ? "Currently eligible"
    : isWaitingForNextCampaign
      ? "Eligible — next campaign"
      : isEligibleAfterChanges
        ? "Eligible after approved changes"
        : "Outreach blocked";

  return (
    <DetailShell>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#95502b]">Enrichment review</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">{businessName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <EnrichmentStatus tone={researchStatus === "verified" ? "success" : bool(record.requires_manual_review) ? "warning" : "neutral"}>{formatEnrichmentLabel(researchStatus)}</EnrichmentStatus>
            <EnrichmentStatus tone={isCurrentlyEligible ? "success" : isWaitingForNextCampaign || isEligibleAfterChanges ? "info" : "danger"}>{eligibilityLabel}</EnrichmentStatus>
            <EnrichmentStatus tone={currentBusinessStatus === "closed" ? "danger" : currentBusinessStatus === "active" ? "success" : "warning"}>{formatEnrichmentLabel(currentBusinessStatus)}</EnrichmentStatus>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">Last checked {formatEnrichmentDate(text(record.updated_at) || text(record.created_at))}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <form action={requeueEnrichmentVerification}>
            <input name="recordId" type="hidden" value={id} /><input name="expectedStatus" type="hidden" value={researchStatus} />
            <Button type="submit" variant="secondary"><SearchCheck size={17} /> Re-run verification</Button>
          </form>
          <form action={markEnrichmentForManualResearch}>
            <input name="recordId" type="hidden" value={id} /><input name="expectedStatus" type="hidden" value={researchStatus} />
            <Button type="submit" variant="secondary"><AlertTriangle size={17} /> Manual research</Button>
          </form>
        </div>
      </div>

      {message ? <p className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f594f] ring-1 ring-[var(--line)]">{message}</p> : null}

      <section className="mt-7 grid gap-4 lg:grid-cols-3">
        <SummaryPanel label="Exact eligibility blockers"><EnrichmentTags empty="No current send blockers" tone="danger" values={strings(record.eligibility_blockers)} /></SummaryPanel>
        <SummaryPanel label="Quality blockers"><EnrichmentTags empty="No quality blockers" tone="warning" values={strings(record.quality_blockers)} /></SummaryPanel>
        <SummaryPanel label="Missing fields"><EnrichmentTags empty="No missing fields" values={strings(record.missing_fields)} /></SummaryPanel>
      </section>

      <section className="mt-7 rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Before and after</p><h2 className="mt-2 font-display text-4xl font-semibold">Proposed field changes</h2></div>
          <p className="max-w-lg text-sm leading-6 text-[var(--muted)]">Each factual value retains its evidence and is applied through a conflict-checking database transaction. Approval alone does not change live data.</p>
        </div>
        <div className="mt-6 grid gap-5">
          {proposals.map((proposal) => <ProposalCard key={text(proposal.id)} proposal={proposal} recordId={id} />)}
          {proposals.length === 0 ? <p className="rounded-2xl bg-[#fbf8f3] p-5 text-sm text-[var(--muted)]">No field changes have been proposed for this record.</p> : null}
        </div>
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        <EmailChecks checks={emailChecks} />
        <DuplicateWarnings duplicates={duplicates} entityId={entityId} />
        <BusinessProfile profile={profile} />
        <OutreachHistory rows={outreach} />
      </div>

      <ChangeHistory changes={changes} />
    </DetailShell>
  );
}

function DetailShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#35533e]" href="/admin/enrichment"><ArrowLeft size={16} /> Back to enrichment</Link><div className="mt-7">{children}</div></div>;
}

function SummaryPanel({ children, label }: { children: React.ReactNode; label: string }) {
  return <div className="rounded-3xl border border-[var(--line)] bg-white p-5"><p className="mb-4 text-sm font-semibold text-[#4a443c]">{label}</p>{children}</div>;
}

function ProposalCard({ proposal, recordId }: { proposal: Row; recordId: string }) {
  const status = text(proposal.status) || "pending";
  const proposalId = text(proposal.id);
  const field = text(proposal.target_field);
  const sourceUrl = safeEnrichmentUrl(text(proposal.source_url));
  return (
    <article className="rounded-3xl border border-[var(--line)] bg-[#fbf8f3] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-3xl font-semibold">{formatEnrichmentLabel(field)}</h3><EnrichmentStatus tone={proposalTone(status)}>{formatEnrichmentLabel(status)}</EnrichmentStatus><EnrichmentStatus tone={text(proposal.confidence) === "high" ? "success" : text(proposal.confidence) === "low" ? "danger" : "warning"}>{formatEnrichmentLabel(text(proposal.confidence))} confidence</EnrichmentStatus></div><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text(proposal.reason)}</p></div>
        <div className="flex flex-wrap gap-2">
          {status === "pending" ? <><ProposalDecision action={approveEnrichmentProposal} label="Approve" proposalId={proposalId} recordId={recordId} status={status} /><ProposalDecision action={rejectEnrichmentProposal} label="Reject" proposalId={proposalId} recordId={recordId} status={status} secondary /></> : null}
          {status === "approved" ? <form action={applyEnrichmentProposal}><input name="recordId" type="hidden" value={recordId} /><input name="proposalId" type="hidden" value={proposalId} /><label className="flex items-center gap-2 text-xs text-[var(--muted)]"><input className="size-4 accent-[#24432f]" name="applyConfirmed" type="checkbox" />Confirm</label><Button className="mt-2" type="submit"><CheckCircle2 size={16} /> Apply</Button></form> : null}
          {status === "applied" ? <form action={rollbackEnrichmentChange}><input name="recordId" type="hidden" value={recordId} /><input name="proposalId" type="hidden" value={proposalId} /><label className="flex items-center gap-2 text-xs text-[var(--muted)]"><input className="size-4 accent-[#8a3c19]" name="rollbackConfirmed" type="checkbox" />Confirm</label><Button className="mt-2" type="submit" variant="secondary"><RotateCcw size={16} /> Roll back</Button></form> : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ValuePanel label="Existing value" value={proposal.previous_value} />
        <ValuePanel label="Proposed value" value={proposal.proposed_value} />
      </div>

      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Evidence" value={text(proposal.source_title) || "Untitled source"} />
        <Info label="Source type" value={formatEnrichmentLabel(text(proposal.source_type))} />
        <Info label="Accessed" value={formatEnrichmentDate(text(proposal.source_accessed_at))} />
        <Info label="Verification" value={`${formatEnrichmentLabel(text(proposal.verification_status))}${text(proposal.verification_method) ? ` · ${text(proposal.verification_method)}` : ""}`} />
      </dl>
      {sourceUrl ? <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#35533e] underline underline-offset-2" href={sourceUrl} rel="noreferrer" target="_blank">View source <ExternalLink size={14} /></a> : null}

      {status === "pending" ? <details className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-[#4a443c]">Edit proposed value</summary><form action={editEnrichmentProposal} className="mt-4"><input name="recordId" type="hidden" value={recordId} /><input name="proposalId" type="hidden" value={proposalId} /><input name="expectedStatus" type="hidden" value={status} /><Textarea className="min-h-24" defaultValue={editableValue(proposal.proposed_value)} name="proposedValue" /><p className="mt-2 text-xs text-[var(--muted)]">Objects and lists may be entered as JSON. Edited values return to pending review.</p><Button className="mt-3" type="submit" variant="secondary">Save edit</Button></form></details> : null}
    </article>
  );
}

function ProposalDecision({ action, label, proposalId, recordId, secondary, status }: { action: (formData: FormData) => Promise<void>; label: string; proposalId: string; recordId: string; secondary?: boolean; status: string }) {
  return <form action={action}><input name="recordId" type="hidden" value={recordId} /><input name="proposalId" type="hidden" value={proposalId} /><input name="expectedStatus" type="hidden" value={status} /><Button type="submit" variant={secondary ? "secondary" : "primary"}>{label}</Button></form>;
}

function ValuePanel({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-2xl bg-white p-4 ring-1 ring-[var(--line)]"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a806f]">{label}</p><pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-[#4a443c]">{displayValue(value)}</pre></div>;
}

function EmailChecks({ checks }: { checks: Row[] }) {
  return <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Email verification</p><h2 className="mt-2 font-display text-4xl font-semibold">Contact checks</h2><div className="mt-5 grid gap-4">{checks.map((check) => <div className="rounded-2xl bg-[#fbf8f3] p-4" key={text(check.id)}><div className="flex flex-wrap items-center justify-between gap-3"><p className="break-all font-semibold">{text(check.email)}</p><EnrichmentStatus tone={["verified", "likely_valid"].includes(text(check.status)) ? "success" : ["invalid", "hard_bounce", "suppressed", "opted_out"].includes(text(check.status)) ? "danger" : "warning"}>{formatEnrichmentLabel(text(check.status))}</EnrichmentStatus></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3"><Info label="Syntax" value={yesNo(check.syntax_valid)} /><Info label="Domain" value={yesNo(check.domain_exists)} /><Info label="MX records" value={yesNo(check.has_mx)} /><Info label="Domain associated" value={yesNo(check.domain_associated)} /><Info label="Prior outreach" value={yesNo(check.has_prior_outreach)} /><Info label="Checked" value={formatEnrichmentDate(text(check.checked_at))} /></dl></div>)}{checks.length === 0 ? <p className="text-sm text-[var(--muted)]">No email verification result has been recorded.</p> : null}</div></section>;
}

function DuplicateWarnings({ duplicates, entityId }: { duplicates: Row[]; entityId: string }) {
  return <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Duplicate protection</p><h2 className="mt-2 font-display text-4xl font-semibold">Possible matches</h2><div className="mt-5 grid gap-3">{duplicates.map((duplicate) => { const isLeft = text(duplicate.left_entity_id) === entityId; const otherType = text(duplicate[isLeft ? "right_entity_type" : "left_entity_type"]); const otherId = text(duplicate[isLeft ? "right_entity_id" : "left_entity_id"]); return <div className="rounded-2xl bg-[#fff9ef] p-4 text-sm text-[#715622]" key={text(duplicate.id)}><div className="flex items-center justify-between gap-3"><p className="font-semibold">{formatEnrichmentLabel(otherType)} {otherId}</p><EnrichmentStatus tone={text(duplicate.status) === "not_duplicate" ? "neutral" : "warning"}>{formatEnrichmentLabel(text(duplicate.status))}</EnrichmentStatus></div><p className="mt-2">Match score {Math.round(number(duplicate.match_score) * 100)}% · {strings(duplicate.match_reasons).map(formatEnrichmentLabel).join(", ") || "Reason stored in structured evidence"}</p></div>; })}{duplicates.length === 0 ? <p className="text-sm text-[var(--muted)]">No duplicate candidate is attached to this record.</p> : null}</div></section>;
}

function BusinessProfile({ profile }: { profile: Row | null }) {
  const entries = profile ? [["Trading name", profile.trading_name], ["Contact page", profile.contact_page_url], ["Enquiry page", profile.enquiry_page_url], ["Phone", profile.phone], ["Address", profile.full_address], ["Postcode", profile.postcode], ["Instagram", profile.instagram_url], ["Facebook", profile.facebook_url], ["Last verified", formatEnrichmentDate(text(profile.last_verified_at))]] : [];
  return <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Business profile</p><h2 className="mt-2 font-display text-4xl font-semibold">Current enrichment</h2>{profile ? <dl className="mt-5 grid gap-4 sm:grid-cols-2">{entries.map(([label, value]) => <Info key={String(label)} label={String(label)} value={text(value) || "Not recorded"} />)}</dl> : <p className="mt-5 text-sm text-[var(--muted)]">No enrichment profile has been applied.</p>}</section>;
}

function OutreachHistory({ rows }: { rows: Row[] }) {
  return <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Outreach history</p><h2 className="mt-2 font-display text-4xl font-semibold">Previous contact</h2><div className="mt-5 grid gap-3">{rows.map((row) => <div className="rounded-2xl bg-[#fbf8f3] p-4 text-sm" key={text(row.id)}><div className="flex items-center justify-between gap-3"><p className="break-all font-semibold">{text(row.email)}</p><EnrichmentStatus tone={["bounced", "complained", "unsubscribed", "suppressed"].includes(text(row.status)) ? "danger" : "neutral"}>{formatEnrichmentLabel(text(row.status))}</EnrichmentStatus></div><p className="mt-2 text-xs text-[var(--muted)]">{formatEnrichmentDate(text(row.sent_at) || text(row.created_at))}{text(row.error_message) ? ` · ${text(row.error_message)}` : ""}</p></div>)}{rows.length === 0 ? <p className="text-sm text-[var(--muted)]">No outreach recipient history is linked to this business.</p> : null}</div></section>;
}

function ChangeHistory({ changes }: { changes: Row[] }) {
  return <section className="mt-7 rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6"><h2 className="flex items-center gap-3 font-display text-4xl font-semibold"><History size={24} className="text-[#95502b]" /> Change log</h2><div className="mt-5 grid gap-3">{changes.map((change) => <div className="grid gap-2 rounded-2xl bg-[#fbf8f3] p-4 text-sm sm:grid-cols-[1fr_auto]" key={text(change.id)}><div><p className="font-semibold">{formatEnrichmentLabel(text(change.action))} {formatEnrichmentLabel(text(change.target_field))}</p><p className="mt-1 text-[var(--muted)]">{displayValue(change.previous_value)} → {displayValue(change.new_value)}</p></div><p className="text-xs text-[var(--muted)]">{formatEnrichmentDate(text(change.created_at))}</p></div>)}{changes.length === 0 ? <p className="text-sm text-[var(--muted)]">No approved changes have been applied.</p> : null}</div></section>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a806f]">{label}</dt><dd className="mt-1 break-words leading-5 text-[#4a443c]">{value}</dd></div>; }
function proposalTone(status: string) { if (["approved", "applied"].includes(status)) return "success" as const; if (["rejected", "conflict"].includes(status)) return "danger" as const; if (status === "rolled_back") return "info" as const; return "warning" as const; }
function editableValue(value: unknown) { return typeof value === "string" ? value : JSON.stringify(value, null, 2); }
function displayValue(value: unknown) { if (value == null) return "Not recorded"; if (typeof value === "string") return value || "Not recorded"; return JSON.stringify(value, null, 2); }
function rows(value: unknown): Row[] { return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : []; }
function object(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function bool(value: unknown) { return value === true; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function yesNo(value: unknown) { return value == null ? "Not checked" : value === true ? "Yes" : "No"; }
