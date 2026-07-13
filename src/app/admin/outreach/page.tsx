import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Ban, CheckCircle2, Mail, MessagesSquare } from "lucide-react";
import { OutreachCampaignComposer } from "@/components/admin/outreach-campaign-composer";
import { requireAdmin } from "@/lib/auth";
import { listOutreachCandidates, listRecentOutreachCampaigns, type OutreachCandidateResult } from "@/lib/outreach";
import type { OutreachCampaignKind } from "@/lib/outreach-email";

export const metadata: Metadata = { title: "Outreach campaigns" };

type CampaignListItem = Awaited<ReturnType<typeof listRecentOutreachCampaigns>>[number];

export default async function AdminOutreachPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; kind?: string; region?: string }>;
}) {
  const [{ message, kind: requestedKind, region }] = await Promise.all([searchParams, requireAdmin()]);
  const kind: OutreachCampaignKind = requestedKind === "follow_up" ? "follow_up" : "initial_invite";
  let candidateResult: OutreachCandidateResult = {
    candidates: [],
    excluded: { invalidEmail: 0, missingEmail: 0, duplicateEmail: 0, suppressed: 0, existingOutreach: 0, unverifiedContact: 0, overLimit: 0 }
  };
  let campaigns: CampaignListItem[] = [];
  let loadError: string | null = null;

  try {
    [candidateResult, campaigns] = await Promise.all([
      listOutreachCandidates({ kind, country: "Scotland", region, followUpAfterDays: 7, limit: 100 }),
      listRecentOutreachCampaigns()
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load outreach campaigns.";
  }

  const excludedCount = Object.values(candidateResult.excluded).reduce((total, count) => total + count, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin outreach</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">Business invitations</h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">Build, preview, approve and track personalised EverAft venue campaigns from one queue.</p>
        </div>
        <Link className="text-sm font-semibold text-[#5c6b52]" href="/admin">Back to admin</Link>
      </div>

      {message ? <p className="mb-6 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f594f] ring-1 ring-[var(--line)]">{message}</p> : null}
      {loadError ? <p className="mb-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19] ring-1 ring-[#f0c2a8]">{loadError}</p> : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Mail size={18} />} label="Eligible now" value={candidateResult.candidates.length} />
        <Stat icon={<Ban size={18} />} label="Excluded safely" value={excludedCount} />
        <Stat icon={<MessagesSquare size={18} />} label="Campaigns" value={campaigns.length} />
        <Stat icon={<CheckCircle2 size={18} />} label="Completed" value={campaigns.filter((campaign) => campaign.status === "sent").length} />
      </section>

      <div className="mb-8 flex flex-wrap gap-3 rounded-3xl border border-[var(--line)] bg-white p-4">
        <Link className={kind === "initial_invite" ? activePill : inactivePill} href="/admin/outreach?kind=initial_invite">First invitations</Link>
        <Link className={kind === "follow_up" ? activePill : inactivePill} href="/admin/outreach?kind=follow_up">Follow-ups after 7 days</Link>
        <Link className={inactivePill} href="/admin/enrichment?blocker=missing_email">Find missing emails</Link>
      </div>

      {!loadError ? (
        <OutreachCampaignComposer candidates={candidateResult.candidates} country="Scotland" kind={kind} region={region} />
      ) : null}

      <section className="mt-10 rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Campaign history</p>
            <h2 className="mt-2 font-display text-4xl font-semibold">Recent approvals and sends</h2>
          </div>
          <p className="text-sm text-[var(--muted)]">Recipient snapshots are retained for audit and suppression checks.</p>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)]">
          {campaigns.map((campaign) => (
            <Link className="grid gap-3 border-b border-[var(--line)] px-4 py-4 transition last:border-b-0 hover:bg-[#fbf8f3] sm:grid-cols-[1fr_auto_auto] sm:items-center" href={`/admin/outreach/campaigns/${campaign.id}`} key={campaign.id}>
              <span>
                <span className="block font-semibold text-[#29251f]">{campaign.name}</span>
                <span className="mt-1 block text-xs text-[var(--muted)]">{campaign.kind.replaceAll("_", " ")} · {campaign.source} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(campaign.created_at))}</span>
              </span>
              <span className="text-sm text-[var(--muted)]">{campaign.sent_count}/{campaign.recipient_count} sent</span>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#35533e]">{campaign.status.replaceAll("_", " ")} <ArrowRight size={16} /></span>
            </Link>
          ))}
          {campaigns.length === 0 ? <p className="px-5 py-8 text-sm text-[var(--muted)]">No campaigns have been created yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

const activePill = "rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white";
const inactivePill = "rounded-full bg-[#f4efe7] px-4 py-2 text-sm font-semibold text-[#4a443c] transition hover:bg-[#e9dfd1]";

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-5">
      <div className="mb-4 grid size-10 place-items-center rounded-full bg-[#f4efe7] text-[#95502b]">{icon}</div>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
