import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Claim reviews"
};

export default async function AdminClaimsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: claims }, { data: venues }] = await Promise.all([
    supabase!.from("venue_claims").select("*").order("created_at", { ascending: false }),
    supabase!.from("venues").select("id, name, slug, town, region")
  ]);
  const venuesById = new Map((venues ?? []).map((venue) => [venue.id, venue]));
  const pendingCount = (claims ?? []).filter((claim) => claim.status === "pending").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin CMS</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">Claim reviews</h1>
          <p className="mt-3 text-[var(--muted)]">Review vendor ownership requests before granting listing access.</p>
        </div>
        <ButtonLink href="/admin" variant="secondary">Back to admin</ButtonLink>
      </div>

      <div className="mb-6 rounded-3xl border border-[#e5d5b7] bg-[#fff9ef] px-5 py-4 text-sm text-[#715622]">
        Founding partner offer: lifetime discount available during launch.
      </div>

      <div className="mb-5 flex items-center gap-2 text-sm text-[var(--muted)]">
        <CheckCircle2 size={17} className="text-[#6a7a5d]" />
        {pendingCount} pending claim{pendingCount === 1 ? "" : "s"}
      </div>

      <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
        {(claims ?? []).map((claim) => {
          const venue = venuesById.get(claim.venue_id);
          return (
            <Link className="grid gap-3 border-b border-[var(--line)] px-5 py-4 transition last:border-b-0 hover:bg-[#fbf8f3] sm:grid-cols-[1.2fr_1fr_auto]" href={`/admin/claims/${claim.id}`} key={claim.id}>
              <div>
                <p className="font-semibold">{venue?.name ?? "Unknown venue"}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{venue ? `${venue.town}, ${venue.region}` : "Venue record unavailable"}</p>
              </div>
              <div className="text-sm text-[var(--muted)]">
                <p className="font-medium text-[#4a443c]">{claim.claimant_name}</p>
                <p>{claim.business_email}</p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#4f5e46]">
                {claim.status} <ArrowRight size={15} />
              </span>
            </Link>
          );
        })}
        {(claims ?? []).length === 0 ? <div className="px-5 py-8 text-sm text-[var(--muted)]">No listing claims have been submitted yet.</div> : null}
      </div>
    </div>
  );
}
