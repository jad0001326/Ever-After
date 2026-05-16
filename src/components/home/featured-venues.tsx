import { VenueCard } from "@/components/venue/venue-card";
import { ButtonLink } from "@/components/ui/button";
import { getFeaturedVenueListings } from "@/lib/venues";

export async function FeaturedVenues() {
  const featured = await getFeaturedVenueListings();

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
    </section>
  );
}
