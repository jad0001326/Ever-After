import { VenueCard } from "@/components/venue/venue-card";
import { ButtonLink } from "@/components/ui/button";
import { getFeaturedVenueListings } from "@/lib/venues";

export async function FeaturedVenues() {
  const { venues: featured, error } = await getFeaturedVenueListings();

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">Curated shortlists</p>
          <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Featured Scottish venues</h2>
        </div>
        <ButtonLink href="/venues" variant="secondary">
          View all venues
        </ButtonLink>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((venue, index) => (
          <VenueCard key={venue.id} priority={index === 0} venue={venue} />
        ))}
      </div>
      {error ? <p className="mt-6 rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm text-[#8a3c19] ring-1 ring-[#f0c2a8]">Supabase connection needed: {error}</p> : null}
      {!error && featured.length === 0 ? (
        <div className="rounded-3xl border border-[var(--line)] bg-white p-6">
          <h3 className="font-display text-3xl font-semibold">Featured venues are being curated</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Browse the full directory while the launch shortlist is reviewed.
          </p>
        </div>
      ) : null}
    </section>
  );
}
