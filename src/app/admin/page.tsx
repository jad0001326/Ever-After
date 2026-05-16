import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Edit, ImagePlus, Plus, UploadCloud } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { gbp } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin dashboard"
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const [{ message }] = await Promise.all([searchParams, requireAdmin()]);
  const supabase = await createClient();
  const { data, error } = await supabase!
    .from("venues")
    .select("id, name, slug, type, region, town, price_from, capacity_max, status")
    .order("updated_at", { ascending: false });
  const venues = data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Admin CMS</p>
          <h1 className="mt-3 font-display text-5xl font-semibold">Venue listings</h1>
          <p className="mt-3 text-[var(--muted)]">Protected admin area for venue operations.</p>
        </div>
        <ButtonLink href="/admin/venues/new">
          <Plus size={17} /> Add venue
        </ButtonLink>
      </div>
      {message ? <p className="mb-6 rounded-2xl bg-white px-4 py-3 text-sm text-[#5f594f] ring-1 ring-[var(--line)]">{message}</p> : null}
      {error ? <p className="mb-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19] ring-1 ring-[#f0c2a8]">Supabase error: {error.message}</p> : null}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <AdminStat icon={<Edit size={18} />} label="Listings" value={venues.length.toString()} />
        <AdminStat icon={<UploadCloud size={18} />} label="Image uploads" value="Supabase storage" />
        <AdminStat icon={<ImagePlus size={18} />} label="CMS scope" value="Venues, images, enquiries" />
      </div>
      <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--line)] px-5 py-4 text-sm font-semibold text-[#5a5248] sm:grid-cols-[1.3fr_1fr_1fr_auto]">
          <span>Venue</span>
          <span className="hidden sm:block">Market</span>
          <span className="hidden sm:block">Commercials</span>
          <span>Action</span>
        </div>
        {venues.map((venue) => (
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[var(--line)] px-5 py-4 last:border-b-0 sm:grid-cols-[1.3fr_1fr_1fr_auto]" key={venue.id}>
            <div>
              <p className="font-semibold">{venue.name}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{venue.type} - {venue.status}</p>
            </div>
            <p className="hidden text-sm text-[var(--muted)] sm:block">{venue.town}, {venue.region}</p>
            <p className="hidden text-sm text-[var(--muted)] sm:block">{gbp.format(venue.price_from)} - {venue.capacity_max} guests</p>
            <Link className="focus-ring inline-flex size-10 items-center justify-center rounded-full bg-[#f4efe7] text-[#3f4d38] transition hover:bg-[#e8dece]" href={`/admin/venues/${venue.id}/edit`} aria-label={`Edit ${venue.name}`}>
              <Edit size={16} />
            </Link>
          </div>
        ))}
        {venues.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[var(--muted)]">No venues in Supabase yet. Use Add venue to create the first listing.</div>
        ) : null}
      </div>
    </div>
  );
}

function AdminStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-5">
      <div className="mb-4 grid size-10 place-items-center rounded-full bg-[#f4efe7] text-[#8b6d3c]">{icon}</div>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
