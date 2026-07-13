import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { VenuePassportReview, type VenuePassportReviewVenue } from "@/components/admin/venue-passport-review";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Venue Passport prototypes" };
export const dynamic = "force-dynamic";

const sampleSlugs = [
  "sorn-castle",
  "dundas-castle",
  "glenapp-castle",
  "harburn-barn",
  "pratis-barns",
  "kingsfield-barn",
  "fonab-castle-hotel",
  "lochside-house-hotel-lodges-and-spa",
  "norton-house-hotel-spa",
  "backhouse-rossie-estate",
  "the-walled-garden",
  "balbirnie-house"
] as const;

const prototypeColumns = "id, slug, name, type, town, region, summary, capacity_max";

export default async function AdminImagePrototypesPage() {
  await requireAdmin();

  const supabase = await createClient();
  if (!supabase) return <PrototypeSetupMessage message="Supabase is not configured for this environment." />;

  const [curatedResult, fallbackResult] = await Promise.all([
    supabase
      .from("venues")
      .select(prototypeColumns)
      .eq("status", "published")
      .in("listing_status", ["published", "claimed"])
      .eq("image_is_representative", true)
      .in("slug", [...sampleSlugs]),
    supabase
      .from("venues")
      .select(prototypeColumns)
      .eq("status", "published")
      .in("listing_status", ["published", "claimed"])
      .eq("image_is_representative", true)
      .order("name", { ascending: true })
      .limit(40)
  ]);

  const error = curatedResult.error ?? fallbackResult.error;
  if (error) return <PrototypeSetupMessage message={`Venue samples could not be loaded: ${error.message}`} />;

  const curatedBySlug = new Map((curatedResult.data ?? []).map((venue) => [venue.slug, venue]));
  const orderedCurated = sampleSlugs.flatMap((slug) => {
    const venue = curatedBySlug.get(slug);
    return venue ? [venue] : [];
  });
  const seen = new Set(orderedCurated.map((venue) => venue.id));
  const venues = [...orderedCurated];

  for (const venue of fallbackResult.data ?? []) {
    if (venues.length >= 12) break;
    if (seen.has(venue.id)) continue;
    seen.add(venue.id);
    venues.push(venue);
  }

  const reviewVenues: VenuePassportReviewVenue[] = venues.slice(0, 12).map((venue) => ({
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    town: venue.town,
    region: venue.region,
    summary: venue.summary,
    capacityMax: venue.capacity_max
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <Link className="focus-ring inline-flex items-center gap-2 rounded-full text-sm font-semibold text-[var(--brand)]" href="/admin">
        <ArrowLeft aria-hidden="true" size={16} /> Back to admin
      </Link>

      <header className="mt-8 border-b border-[var(--line)] pb-9">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="font-display text-5xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-6xl">Venue Passport prototypes</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              A rights-safe visual layer for venues that do not yet have approved photography. Compare two directions across twelve real listings.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#edf2eb] px-4 py-2 text-sm font-semibold text-[#31513a]">
            <ShieldCheck aria-hidden="true" size={17} /> Public listings unchanged
          </div>
        </div>
      </header>

      <main className="pt-12">
        {reviewVenues.length > 0 ? (
          <VenuePassportReview venues={reviewVenues} />
        ) : (
          <PrototypeSetupMessage message="No published representative-image venues were available for the prototype." />
        )}
      </main>
    </div>
  );
}

function PrototypeSetupMessage({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-[var(--line)] bg-white p-8">
        <h1 className="font-display text-4xl font-semibold">Venue Passport prototypes</h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">{message}</p>
        <Link className="mt-6 inline-flex text-sm font-semibold text-[var(--brand)]" href="/admin">Return to admin</Link>
      </div>
    </div>
  );
}
