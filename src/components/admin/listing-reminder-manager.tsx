"use client";

import { useMemo, useState } from "react";
import { CircleAlert, Clock3, Eye, MailCheck, Users } from "lucide-react";
import { sendListingRemindersAction } from "@/app/actions/listing-reminders";
import { Button } from "@/components/ui/button";
import { buildListingReminderEmail } from "@/lib/listing-reminder-email";
import type { ListingReminderCandidate } from "@/lib/listing-reminders";

export function ListingReminderManager({ candidates }: { candidates: ListingReminderCandidate[] }) {
  const eligibleCandidates = candidates.filter((candidate) => candidate.eligible);
  const [selected, setSelected] = useState(() => new Set(eligibleCandidates.map((candidate) => candidate.id)));
  const [previewId, setPreviewId] = useState<string | null>(() => eligibleCandidates[0]?.id ?? candidates[0]?.id ?? null);
  const sample = candidates.find((candidate) => candidate.id === previewId)
    ?? candidates.find((candidate) => selected.has(candidate.id))
    ?? candidates[0];
  const preview = useMemo(
    () => sample ? buildListingReminderEmail({
      venueName: sample.venueName,
      venueSlug: sample.venueSlug,
      recipientName: sample.recipientName,
      score: sample.score,
      total: sample.total,
      missing: sample.missing
    }) : null,
    [sample]
  );

  function toggleCandidate(candidate: ListingReminderCandidate) {
    if (!candidate.eligible) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(candidate.id)) next.delete(candidate.id);
      else next.add(candidate.id);
      return next;
    });
    setPreviewId(candidate.id);
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === eligibleCandidates.length
        ? new Set()
        : new Set(eligibleCandidates.map((candidate) => candidate.id))
    );
  }

  return (
    <form action={sendListingRemindersAction} className="grid gap-6">
      <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">1. Registered accounts</p>
            <h2 className="mt-2 font-display text-4xl font-semibold">Choose incomplete listings</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">Only approved venue owners whose listing is below 6/6 are shown. Recent approvals, recent reminders, suppressed addresses and listings with work awaiting review are paused automatically.</p>
          </div>
          <div className="rounded-2xl bg-[#f4efe7] px-4 py-3 text-sm text-[#4a443c]">
            <Users className="mr-2 inline text-[#95502b]" size={17} />
            <strong>{selected.size}</strong> selected
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button disabled={eligibleCandidates.length === 0} onClick={toggleAll} type="button" variant="secondary">
            {selected.size === eligibleCandidates.length ? "Clear selection" : "Select all eligible"}
          </Button>
        </div>

        <div className="mt-5 max-h-[36rem] overflow-auto rounded-2xl border border-[var(--line)]">
          {candidates.map((candidate) => (
            <div className="grid gap-3 border-b border-[var(--line)] px-4 py-4 last:border-b-0 hover:bg-[#fbf8f3] lg:grid-cols-[auto_1.1fr_1fr_auto] lg:items-start" key={candidate.id}>
              <input
                aria-label={candidate.eligible ? `Send a listing reminder to ${candidate.venueName}` : `${candidate.venueName} is not currently eligible`}
                checked={selected.has(candidate.id)}
                className="mt-1 size-4 accent-[#24432f]"
                disabled={!candidate.eligible}
                name="venueIds"
                onChange={() => toggleCandidate(candidate)}
                type="checkbox"
                value={candidate.id}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#29251f]">{candidate.venueName}</p>
                  <span className={candidate.eligible ? "rounded-full bg-[#e8f2e5] px-2 py-0.5 text-xs font-semibold text-[#345033]" : "rounded-full bg-[#f4efe7] px-2 py-0.5 text-xs font-semibold text-[#715f49]"}>
                    {candidate.eligible ? "Ready" : "Paused"}
                  </span>
                </div>
                <p className="mt-1 break-all text-xs text-[var(--muted)]">{candidate.recipientName || "Registered venue account"} · {candidate.recipientEmail || "No account email"}</p>
                <p className="mt-2 text-sm font-semibold text-[#3f4d38]">Listing health: {candidate.score}/{candidate.total}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Needs: {candidate.missing.join(", ")}</p>
              </div>
              <div className="text-xs leading-5 text-[var(--muted)]">
                {candidate.blockedReason ? (
                  <p className="flex gap-2 rounded-xl bg-[#fff9ef] px-3 py-2 text-[#715622]"><CircleAlert className="mt-0.5 shrink-0" size={14} />{candidate.blockedReason}</p>
                ) : (
                  <p className="rounded-xl bg-[#eef4ea] px-3 py-2 text-[#3f5c35]">Ready to send after final server-side eligibility checks.</p>
                )}
                <p className="mt-2 flex items-center gap-2"><Clock3 size={14} />{candidate.lastReminderAt ? `Last reminder ${formatDate(candidate.lastReminderAt)} · ${candidate.reminderCount} sent` : "No listing reminder sent yet"}</p>
              </div>
              <Button
                aria-pressed={sample?.id === candidate.id}
                className="w-full px-4 lg:w-auto"
                onClick={() => setPreviewId(candidate.id)}
                type="button"
                variant="secondary"
              >
                <Eye size={15} /> Preview
              </Button>
            </div>
          ))}
          {candidates.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[var(--muted)]">There are no incomplete claimed venue listings.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[#f4efe7] text-[#95502b]"><Eye size={18} /></span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">2. Rich HTML preview</p>
            <h2 className="font-display text-4xl font-semibold">See exactly what they receive</h2>
          </div>
        </div>
        {preview && sample ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-[#f2ede4]">
            <div className="border-b border-[var(--line)] bg-white px-4 py-3 text-sm">
              <p><strong>To:</strong> {sample.recipientEmail || "No valid account email"}</p>
              <p className="mt-1"><strong>Subject:</strong> {preview.subject}</p>
            </div>
            <iframe className="h-[820px] w-full bg-[#f2ede4]" sandbox="" srcDoc={preview.html} title={`EverAft listing reminder preview for ${sample.venueName}`} />
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-[#f4efe7] px-4 py-4 text-sm text-[var(--muted)]">There is no incomplete listing to preview.</p>
        )}
      </section>

      <section className="rounded-3xl border border-[#d7c6aa] bg-[#fffaf0] p-5 sm:p-6">
        <label className="flex items-start gap-3 text-sm leading-6 text-[#4a443c]">
          <input className="mt-1 size-4 shrink-0 accent-[#24432f]" name="sendConfirmed" required type="checkbox" />
          <span>I have reviewed the selected registered accounts and the personalised rich HTML preview. I understand these service emails send immediately and successful sends are recorded in the venue claim audit log.</span>
        </label>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">Eligibility is checked again immediately before delivery. A maximum of 100 reminders can be sent at once.</p>
          <Button disabled={selected.size === 0} type="submit">
            <MailCheck size={17} /> Send {selected.size} reminder{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      </section>
    </form>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}
