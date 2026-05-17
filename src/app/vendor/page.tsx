import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { VendorUpdateForm } from "@/components/vendor/vendor-update-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Vendor dashboard"
};

export default async function VendorPage() {
  const { user } = await requireUser("/vendor", "Sign in to access your vendor dashboard");
  const supabase = await createClient();
  const [{ data: venues }, { data: requests }] = await Promise.all([
    supabase!.from("venues").select("*").eq("claimed_by", user.id).eq("is_claimed", true).order("updated_at", { ascending: false }),
    supabase!.from("vendor_update_requests").select("*").eq("vendor_user_id", user.id).order("created_at", { ascending: false })
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Vendor</p>
        <h1 className="mt-3 font-display text-5xl font-semibold">Your claimed venues</h1>
        <p className="mt-3 text-[var(--muted)]">Request listing updates for EverAft admin review.</p>
      </div>

      <p className="mb-6 rounded-3xl border border-[#e5d5b7] bg-[#fff9ef] px-5 py-4 text-sm text-[#715622]">
        Founding partner offer: lifetime discount available during launch.
      </p>

      <div className="grid gap-6">
        {(venues ?? []).map((venue) => {
          const venueRequests = (requests ?? []).filter((request) => request.venue_id === venue.id);
          return (
            <section className="rounded-3xl border border-[var(--line)] bg-white p-6" key={venue.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-3xl font-semibold">{venue.name}</h2>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#eef4ea] px-3 py-1 text-xs font-semibold text-[#3f5c35] ring-1 ring-[#d7e3d2]">
                      <ShieldCheck size={14} /> Managed by venue
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">Listing: {venue.listing_status ?? venue.status} - Claim: {venue.claim_status ?? "approved"}</p>
                </div>
                <Link className="text-sm font-semibold text-[#5c6b52]" href={`/venues/${venue.slug}`}>View listing</Link>
              </div>

              <VendorUpdateForm venue={venue} />

              <div className="mt-5">
                <p className="text-sm font-semibold text-[#4a443c]">Recent requests</p>
                <div className="mt-3 grid gap-2">
                  {venueRequests.slice(0, 3).map((request) => (
                    <div className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm" key={request.id}>
                      <p className="font-medium">{request.status}</p>
                      <p className="mt-1 text-[var(--muted)]">{request.requested_message}</p>
                    </div>
                  ))}
                  {venueRequests.length === 0 ? <p className="text-sm text-[var(--muted)]">No update requests yet.</p> : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {(venues ?? []).length === 0 ? (
        <div className="rounded-3xl border border-[var(--line)] bg-white p-8 text-center">
          <h2 className="font-display text-3xl font-semibold">No approved claims yet</h2>
          <p className="mt-3 text-sm text-[var(--muted)]">Once an admin approves your venue claim, it will appear here.</p>
          <Link className="mt-5 inline-flex text-sm font-semibold text-[#5c6b52]" href="/venues">Browse venues</Link>
        </div>
      ) : null}
    </div>
  );
}
