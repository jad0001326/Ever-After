import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, MailCheck, ShieldCheck, Users } from "lucide-react";
import { sendOutreachCampaignAction, updateOutreachRecipientAction } from "@/app/actions/outreach";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { getOutreachCampaign } from "@/lib/outreach";
import { buildOutreachEmail } from "@/lib/outreach-email";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "Campaign approval" };

export default async function CampaignApprovalPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  await requireAdmin();
  const [{ id }, { message }] = await Promise.all([params, searchParams]);
  const { campaign, recipients, delivery } = await getOutreachCampaign(id);
  const sample = recipients[0];
  const preview = sample
    ? buildOutreachEmail({
        kind: campaign.kind,
        copy: {
          subject: campaign.subject,
          preheader: campaign.preheader,
          introText: campaign.intro_text,
          offerText: campaign.offer_text
        },
        recipient: {
          businessName: sample.business_name,
          town: sample.town,
          venueSlug: sample.venue_slug,
          unsubscribeUrl: absoluteUrl("/outreach/unsubscribe?preview=1")
        }
      })
    : null;
  const sendingEnabled = process.env.OUTREACH_SENDING_ENABLED === "true";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#35533e]" href="/admin/outreach"><ArrowLeft size={16} /> Back to campaigns</Link>
      <div className="mt-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#95502b]">Approval checkpoint</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">{campaign.name}</h1>
          <p className="mt-3 text-[var(--muted)]">Review the frozen audience and branded message before authorising delivery.</p>
        </div>
        <span className="w-fit rounded-full bg-[#f4efe7] px-4 py-2 text-sm font-semibold text-[#4a443c]">{campaign.status.replaceAll("_", " ")}</span>
      </div>

      {message ? <p className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f594f] ring-1 ring-[var(--line)]">{message}</p> : null}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat icon={<Users size={18} />} label="Accepted" value={delivery.accepted} />
        <Stat icon={<MailCheck size={18} />} label="Delivered" value={delivery.delivered} />
        <Stat icon={<AlertTriangle size={18} />} label="Bounced" value={delivery.bounced} />
        <Stat icon={<AlertTriangle size={18} />} label="Unsubscribed" value={delivery.unsubscribed} />
        <Stat icon={<AlertTriangle size={18} />} label="Failed" value={delivery.failed} />
        <Stat icon={<ShieldCheck size={18} />} label="Suppressed" value={delivery.suppressed} />
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Email preview</p>
          {preview ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[#f2ede4]">
              <div className="border-b border-[var(--line)] bg-white px-4 py-3 text-sm"><strong>Subject:</strong> {preview.subject}</div>
              <iframe className="h-[820px] w-full" sandbox="" srcDoc={preview.html} title="Approved EverAft outreach email" />
            </div>
          ) : <p className="mt-5 text-sm text-[var(--muted)]">This campaign has no recipients.</p>}
        </section>

        <div className="grid content-start gap-6">
          <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">Frozen audience</p>
            <div className="mt-4 max-h-[34rem] overflow-auto rounded-2xl border border-[var(--line)]">
              {recipients.map((recipient) => (
                <div className="border-b border-[var(--line)] px-4 py-3 text-sm last:border-b-0" key={recipient.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#29251f]">{recipient.business_name}</p>
                      <p className="mt-1 break-all text-xs text-[var(--muted)]">{recipient.email}</p>
                      {recipient.contact_source_url ? <a className="mt-1 block break-all text-xs font-semibold text-[#5c6b52] underline underline-offset-2" href={recipient.contact_source_url} rel="noreferrer" target="_blank">Public contact source</a> : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {recipient.status === "sent" || recipient.status === "delivered" ? (
                          <form action={updateOutreachRecipientAction}>
                            <input name="campaignId" type="hidden" value={campaign.id} />
                            <input name="recipientId" type="hidden" value={recipient.id} />
                            <button className="text-[11px] font-semibold text-[#35533e] underline underline-offset-2" name="recipientAction" type="submit" value="replied">Mark replied</button>
                          </form>
                        ) : null}
                        {!["suppressed", "unsubscribed", "complained", "bounced"].includes(recipient.status) ? (
                          <form action={updateOutreachRecipientAction}>
                            <input name="campaignId" type="hidden" value={campaign.id} />
                            <input name="recipientId" type="hidden" value={recipient.id} />
                            <button className="text-[11px] font-semibold text-[#8a3c19] underline underline-offset-2" name="recipientAction" type="submit" value="suppress">Suppress address</button>
                          </form>
                        ) : null}
                      </div>
                      {recipient.status === "bounced" && recipient.bounce_message ? <p className="mt-2 text-xs leading-5 text-[#8a3c19]">{recipient.bounce_message}</p> : null}
                    </div>
                    <span className="rounded-full bg-[#f4efe7] px-2 py-1 text-[11px] font-semibold text-[#5b5348]">{recipient.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {campaign.status === "draft" ? (
            <section className="rounded-3xl border border-[#d7c6aa] bg-[#fffaf0] p-5 sm:p-6">
              {!sendingEnabled ? (
                <p className="mb-5 rounded-2xl bg-[#fff1df] px-4 py-3 text-sm leading-6 text-[#7b451f]"><AlertTriangle className="mr-2 inline" size={17} />Production sending is currently disabled. This is the safe default until Resend, DNS and test emails are verified.</p>
              ) : null}
              <form action={sendOutreachCampaignAction}>
                <input name="campaignId" type="hidden" value={campaign.id} />
                <label className="flex items-start gap-3 text-sm leading-6 text-[#4a443c]">
                  <input className="mt-1 size-4 shrink-0 accent-[#24432f]" name="approvalConfirmed" required type="checkbox" />
                  <span>I have reviewed the recipient list, public contact sources, subject and HTML preview; confirmed these are eligible corporate business contacts rather than sole traders or personal subscribers; and approve sending this exact campaign to all {campaign.recipient_count} listed businesses.</span>
                </label>
                <Button className="mt-5 w-full" disabled={!sendingEnabled} type="submit"><CheckCircle2 size={17} /> Approve and send campaign</Button>
              </form>
            </section>
          ) : (
            <section className="rounded-3xl border border-[#cad9c8] bg-[#f3f8f1] p-5 text-sm leading-6 text-[#35533e]">
              <CheckCircle2 className="mr-2 inline" size={18} />This campaign has passed its approval checkpoint and cannot be sent again.
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-5">
      <div className="mb-4 grid size-10 place-items-center rounded-full bg-[#f4efe7] text-[#95502b]">{icon}</div>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
