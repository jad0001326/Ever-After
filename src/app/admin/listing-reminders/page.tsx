import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { BellRing, CheckCircle2, Clock3, FileClock, Send } from "lucide-react";
import { ListingReminderManager } from "@/components/admin/listing-reminder-manager";
import { requireAdmin } from "@/lib/auth";
import { emailNotificationsEnabled } from "@/lib/email";
import { listIncompleteListingReminderCandidates, type ListingReminderCandidate } from "@/lib/listing-reminders";

export const metadata: Metadata = { title: "Listing reminders" };

export default async function AdminListingRemindersPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  await requireAdmin();

  let candidates: ListingReminderCandidate[] = [];
  let loadError: string | null = null;
  try {
    candidates = await listIncompleteListingReminderCandidates();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load incomplete listings.";
  }

  const eligible = candidates.filter((candidate) => candidate.eligible).length;
  const pendingReview = candidates.filter((candidate) => candidate.hasPendingWork).length;
  const totalSent = candidates.reduce((total, candidate) => total + candidate.reminderCount, 0);
  const deliveryReady = emailNotificationsEnabled();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin service email</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">Incomplete listing reminders</h1>
          <p className="mt-3 max-w-3xl text-[var(--muted)]">Review registered venue accounts whose claimed listing is below the six core completion checks, preview the invite-style email and send selected reminders.</p>
        </div>
        <Link className="text-sm font-semibold text-[#5c6b52]" href="/admin">Back to admin</Link>
      </div>

      {message ? <p className="mb-6 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f594f] ring-1 ring-[var(--line)]">{message}</p> : null}
      {loadError ? <p className="mb-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19] ring-1 ring-[#f0c2a8]">{loadError}</p> : null}
      {!deliveryReady ? (
        <p className="mb-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19] ring-1 ring-[#f0c2a8]">Email delivery is not configured in this environment. The queue and preview are available, but sends will fail safely until RESEND_API_KEY and RESEND_FROM_EMAIL are configured.</p>
      ) : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<BellRing size={18} />} label="Incomplete listings" value={candidates.length} />
        <Stat icon={<CheckCircle2 size={18} />} label="Eligible now" value={eligible} />
        <Stat icon={<FileClock size={18} />} label="Work under review" value={pendingReview} />
        <Stat icon={<Send size={18} />} label="Reminders recorded" value={totalSent} />
      </section>

      <div className="mb-8 flex flex-wrap gap-3 rounded-3xl border border-[var(--line)] bg-white p-4 text-sm">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#eef4ea] px-4 py-2 font-semibold text-[#345033]"><CheckCircle2 size={15} /> Eligible accounts are preselected</span>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#f4efe7] px-4 py-2 font-semibold text-[#715f49]"><Clock3 size={15} /> Seven-day approval and reminder cooldowns</span>
        <Link className="rounded-full bg-[#f4efe7] px-4 py-2 font-semibold text-[#4a443c] transition hover:bg-[#e9dfd1]" href="/admin/updates">Review listing changes</Link>
        <Link className="rounded-full bg-[#f4efe7] px-4 py-2 font-semibold text-[#4a443c] transition hover:bg-[#e9dfd1]" href="/admin/images">Review photography</Link>
      </div>

      {!loadError ? <ListingReminderManager candidates={candidates} /> : null}
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
