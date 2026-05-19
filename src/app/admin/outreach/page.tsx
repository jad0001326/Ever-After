import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { updateVenueOutreach } from "@/app/actions/admin";
import { OutreachEmailCard } from "@/components/admin/outreach-email-card";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Outreach queue"
};

type OutreachVenue = {
  id: string;
  slug: string;
  name: string;
  town: string;
  region: string;
  listing_status: string | null;
  claim_status: string | null;
  invite_status: "not_sent" | "sent" | "bounced" | "replied" | "claimed" | null;
  invite_sent_at: string | null;
  official_website_url: string | null;
  official_gallery_url: string | null;
  vendor_contact_email: string | null;
  image_is_representative: boolean | null;
  is_claimed: boolean | null;
  outreach_notes: string | null;
  status: string;
};

export default async function AdminOutreachPage({ searchParams }: { searchParams: Promise<{ message?: string; status?: string }> }) {
  const [{ message, status }] = await Promise.all([searchParams, requireAdmin()]);
  const supabase = await createClient();
  const { data, error } = await supabase!
    .from("venues")
    .select("id, slug, name, town, region, listing_status, claim_status, invite_status, invite_sent_at, official_website_url, official_gallery_url, vendor_contact_email, image_is_representative, is_claimed, outreach_notes, status")
    .order("invite_sent_at", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: false });
  const venues = ((data ?? []) as OutreachVenue[])
    .filter((venue) => !venue.is_claimed)
    .filter((venue) => (status ? (venue.invite_status ?? "not_sent") === status : true))
    .sort((a, b) => outreachScore(b) - outreachScore(a));
  const stats = {
    notSent: venues.filter((venue) => (venue.invite_status ?? "not_sent") === "not_sent").length,
    sent: venues.filter((venue) => venue.invite_status === "sent").length,
    replied: venues.filter((venue) => venue.invite_status === "replied").length,
    needsEmail: venues.filter((venue) => !venue.vendor_contact_email).length
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin outreach</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">Venue acquisition queue</h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">Copy founding partner invites, track manual outreach, and move venues toward claimed listings.</p>
        </div>
        <Link className="text-sm font-semibold text-[#5c6b52]" href="/admin">Back to admin</Link>
      </div>

      {message ? <p className="mb-6 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f594f] ring-1 ring-[var(--line)]">{message}</p> : null}
      {error ? <p className="mb-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19] ring-1 ring-[#f0c2a8]">Supabase error: {error.message}</p> : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OutreachStat label="Not sent" value={stats.notSent} href="/admin/outreach?status=not_sent" />
        <OutreachStat label="Sent" value={stats.sent} href="/admin/outreach?status=sent" />
        <OutreachStat label="Replied" value={stats.replied} href="/admin/outreach?status=replied" />
        <OutreachStat label="Needs email" value={stats.needsEmail} href="/admin?quality=missing_vendor_email" />
      </section>

      <div className="grid gap-5">
        {venues.map((venue) => (
          <section className="rounded-3xl border border-[var(--line)] bg-white p-5" key={venue.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-3xl font-semibold">{venue.name}</h2>
                  <span className="rounded-full bg-[#f4efe7] px-3 py-1 text-xs font-semibold text-[#4f4a43]">{venue.invite_status ?? "not_sent"}</span>
                  {venue.vendor_contact_email ? <span className="rounded-full bg-[#eef4ea] px-3 py-1 text-xs font-semibold text-[#3f5c35]">Email found</span> : null}
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{venue.town}, {venue.region} - {venue.listing_status ?? venue.status} - {venue.claim_status ?? "unclaimed"}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <Link className="font-semibold text-[#5c6b52]" href={`/venues/${venue.slug}`}>View listing</Link>
                  <Link className="font-semibold text-[#5c6b52]" href={`/venues/${venue.slug}/claim`}>Claim URL</Link>
                  {venue.official_website_url ? <a className="font-semibold text-[#5c6b52]" href={venue.official_website_url} rel="noopener noreferrer" target="_blank">Official website</a> : null}
                  {venue.vendor_contact_email ? <a className="font-semibold text-[#5c6b52]" href={`mailto:${venue.vendor_contact_email}`}>{venue.vendor_contact_email}</a> : null}
                </div>
              </div>
              <div className="rounded-2xl bg-[#fbf8f3] px-4 py-3 text-sm text-[#4a443c]">
                <p className="font-semibold">Target score: {outreachScore(venue)}/5</p>
                <p className="mt-1 text-[var(--muted)]">{targetReason(venue)}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
              <OutreachEmailCard
                claimUrl={absoluteUrl(`/venues/${venue.slug}/claim`)}
                galleryUrl={venue.official_gallery_url}
                name={venue.name}
                town={venue.town}
              />
              <form action={updateVenueOutreach} className="rounded-2xl border border-[var(--line)] p-4">
                <input name="venueId" type="hidden" value={venue.id} />
                <label className="grid gap-2 text-sm font-medium text-[#4a443c]">
                  Outreach notes
                  <textarea
                    className="focus-ring min-h-32 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                    name="outreachNotes"
                    placeholder="Sent founding partner offer, wrong contact, follow-up needed..."
                    defaultValue={venue.outreach_notes ?? ""}
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button name="outreachAction" type="submit" value="save_notes" variant="secondary">Save notes</Button>
                  <Button name="outreachAction" type="submit" value="mark_sent"><Mail size={16} /> Mark sent</Button>
                  <Button name="outreachAction" type="submit" value="mark_replied" variant="secondary"><ShieldCheck size={16} /> Mark replied</Button>
                  <Button name="outreachAction" type="submit" value="mark_bounced" variant="secondary">Bounced</Button>
                </div>
              </form>
            </div>
          </section>
        ))}
        {venues.length === 0 ? (
          <div className="rounded-3xl border border-[var(--line)] bg-white p-8 text-center">
            <h2 className="font-display text-3xl font-semibold">No venues in this outreach view</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">Clear the status filter or review claimed venues from the admin dashboard.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function outreachScore(venue: OutreachVenue) {
  return [
    venue.vendor_contact_email,
    venue.official_website_url,
    venue.official_gallery_url,
    (venue.listing_status ?? venue.status) === "published",
    venue.image_is_representative
  ].filter(Boolean).length;
}

function targetReason(venue: OutreachVenue) {
  const reasons = [];
  if (venue.vendor_contact_email) reasons.push("email ready");
  if (venue.official_gallery_url) reasons.push("gallery found");
  if (!venue.vendor_contact_email) reasons.push("needs contact");
  if (venue.image_is_representative) reasons.push("image approval opportunity");
  return reasons.join(", ") || "needs review";
}

function OutreachStat({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link className="rounded-3xl border border-[var(--line)] bg-white p-5 transition hover:bg-[#fbf8f3]" href={href}>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">{value} <ArrowRight size={17} /></p>
    </Link>
  );
}
