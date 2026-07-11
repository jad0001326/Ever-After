"use client";

import { useMemo, useState } from "react";
import { Eye, MailCheck, Users } from "lucide-react";
import { createOutreachCampaignDraftAction } from "@/app/actions/outreach";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { buildOutreachEmail, defaultOutreachCopy, type OutreachCampaignKind } from "@/lib/outreach-email";
import type { OutreachCandidate } from "@/lib/outreach-types";
import { absoluteUrl } from "@/lib/utils";

export function OutreachCampaignComposer({
  candidates,
  country,
  kind,
  region
}: {
  candidates: OutreachCandidate[];
  country: string;
  kind: OutreachCampaignKind;
  region?: string;
}) {
  const defaults = defaultOutreachCopy[kind];
  const [selected, setSelected] = useState(() => new Set(candidates.map((candidate) => candidate.id)));
  const [subject, setSubject] = useState(defaults.subject);
  const [preheader, setPreheader] = useState(defaults.preheader);
  const [introText, setIntroText] = useState(defaults.introText);
  const [offerText, setOfferText] = useState(defaults.offerText);
  const sample = candidates.find((candidate) => selected.has(candidate.id)) ?? candidates[0];
  const preview = useMemo(
    () =>
      sample
        ? buildOutreachEmail({
            kind,
            copy: { subject, preheader, introText, offerText },
            recipient: {
              businessName: sample.name,
              town: sample.town,
              venueSlug: sample.slug,
              unsubscribeUrl: absoluteUrl("/outreach/unsubscribe?preview=1")
            }
          })
        : null,
    [introText, kind, offerText, preheader, sample, subject]
  );

  function toggleVenue(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => (current.size === candidates.length ? new Set() : new Set(candidates.map((candidate) => candidate.id))));
  }

  return (
    <form action={createOutreachCampaignDraftAction} className="grid gap-6">
      <input name="kind" type="hidden" value={kind} />
      <input name="country" type="hidden" value={country} />
      {region ? <input name="region" type="hidden" value={region} /> : null}
      <input name="followUpAfterDays" type="hidden" value="7" />

      <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">1. Audience</p>
            <h2 className="mt-2 font-display text-4xl font-semibold">Choose the businesses</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Only published, unclaimed venues with valid, unsuppressed contact addresses are shown.</p>
          </div>
          <div className="rounded-2xl bg-[#f4efe7] px-4 py-3 text-sm text-[#4a443c]">
            <Users className="mr-2 inline text-[#95502b]" size={17} />
            <strong>{selected.size}</strong> selected
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={toggleAll} type="button" variant="secondary">
            {selected.size === candidates.length ? "Clear selection" : "Select all eligible"}
          </Button>
        </div>
        <div className="mt-5 max-h-[28rem] overflow-auto rounded-2xl border border-[var(--line)]">
          {candidates.map((candidate) => (
            <label className="grid cursor-pointer grid-cols-[auto_1fr] gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0 hover:bg-[#fbf8f3] sm:grid-cols-[auto_1fr_auto]" key={candidate.id}>
              <input
                checked={selected.has(candidate.id)}
                className="mt-1 size-4 accent-[#24432f]"
                name="venueIds"
                onChange={() => toggleVenue(candidate.id)}
                type="checkbox"
                value={candidate.id}
              />
              <span>
                <span className="block font-semibold text-[#29251f]">{candidate.name}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{candidate.town}, {candidate.region}</span>
              </span>
              <span className="col-start-2 break-all text-xs text-[var(--muted)] sm:col-start-auto sm:text-right">{candidate.email}</span>
            </label>
          ))}
          {candidates.length === 0 ? <p className="px-5 py-8 text-sm text-[var(--muted)]">No eligible venues are available for this campaign type.</p> : null}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">2. Message</p>
        <h2 className="mt-2 font-display text-4xl font-semibold">Shape the invitation</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use <code>{"{business_name}"}</code> and <code>{"{town}"}</code> for safe personalisation.</p>
        <div className="mt-6 grid gap-5">
          <Field label="Campaign name">
            <Input name="campaignName" required defaultValue={kind === "follow_up" ? "Venue follow-up" : "Founding venue invitation"} maxLength={120} />
          </Field>
          <Field label="Email subject">
            <Input name="subject" required maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} />
          </Field>
          <Field label="Inbox preview text">
            <Input name="preheader" required maxLength={220} value={preheader} onChange={(event) => setPreheader(event.target.value)} />
          </Field>
          <Field label="Main invitation wording">
            <Textarea name="introText" required maxLength={2000} value={introText} onChange={(event) => setIntroText(event.target.value)} />
          </Field>
          <Field label="Founding partner offer">
            <Textarea className="min-h-24" name="offerText" required maxLength={1000} value={offerText} onChange={(event) => setOfferText(event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[#f4efe7] text-[#95502b]"><Eye size={18} /></span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">3. Preview</p>
            <h2 className="font-display text-4xl font-semibold">See exactly what they receive</h2>
          </div>
        </div>
        {preview ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-[#f2ede4]">
            <div className="border-b border-[var(--line)] bg-white px-4 py-3 text-sm"><strong>Subject:</strong> {preview.subject}</div>
            <iframe className="h-[760px] w-full bg-[#f2ede4]" sandbox="" srcDoc={preview.html} title="EverAft outreach email preview" />
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-[#f4efe7] px-4 py-4 text-sm text-[var(--muted)]">Select a venue to generate the personalised preview.</p>
        )}
      </section>

      <section className="rounded-3xl border border-[#d7c6aa] bg-[#fffaf0] p-5 sm:p-6">
        <label className="flex items-start gap-3 text-sm leading-6 text-[#4a443c]">
          <input className="mt-1 size-4 shrink-0 accent-[#24432f]" name="complianceConfirmed" required type="checkbox" />
          <span>I confirm the selected addresses are appropriate business contacts and the recipients are corporate subscribers or EverAft otherwise has a valid basis to contact them. Suppressed addresses will still be removed automatically before sending.</span>
        </label>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">This creates an approval draft. It does not send any email.</p>
          <Button disabled={selected.size === 0} type="submit"><MailCheck size={17} /> Create approval draft</Button>
        </div>
      </section>
    </form>
  );
}
