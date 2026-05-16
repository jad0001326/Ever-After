import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, MapPin, UsersRound } from "lucide-react";
import { EnquiryForm } from "@/components/venue/enquiry-form";
import { FavouriteButton } from "@/components/venue/favourite-button";
import { VenueGallery } from "@/components/venue/venue-gallery";
import { absoluteUrl, formatCapacity, gbp } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getVenueListingBySlug } from "@/lib/venues";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenueListingBySlug(slug);
  if (!venue) return {};

  return {
    title: venue.name,
    description: venue.summary,
    alternates: { canonical: `/venues/${venue.slug}` },
    openGraph: {
      title: venue.name,
      description: venue.summary,
      images: [{ url: venue.heroImage }]
    }
  };
}

export default async function VenuePage({ params }: PageProps) {
  const { slug } = await params;
  const venue = await getVenueListingBySlug(slug);
  if (!venue) notFound();

  const supabase = await createClient();
  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  const favourite = user
    ? await supabase
        ?.from("favourites")
        .select("venue_id")
        .match({ user_id: user.id, venue_id: venue.id })
        .maybeSingle()
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EventVenue",
    name: venue.name,
    description: venue.summary,
    image: venue.images.map((image) => image.url),
    address: {
      "@type": "PostalAddress",
      addressLocality: venue.town,
      addressRegion: venue.region,
      addressCountry: "GB"
    },
    maximumAttendeeCapacity: venue.capacityMax,
    url: absoluteUrl(`/venues/${venue.slug}`)
  };

  return (
    <article className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">{venue.type}</p>
          <h1 className="mt-3 font-display text-5xl font-semibold sm:text-6xl">{venue.name}</h1>
          <p className="mt-3 flex items-center gap-2 text-[var(--muted)]">
            <MapPin size={17} /> {venue.town}, {venue.region}
          </p>
        </div>
        <FavouriteButton initialSaved={Boolean(favourite?.data)} venueId={venue.id} />
      </div>

      <VenueGallery venue={venue} />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-8">
          <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
            <h2 className="font-display text-3xl font-semibold">About the venue</h2>
            <p className="mt-4 text-base leading-8 text-[var(--muted)]">{venue.description}</p>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <InfoTile title="Pricing" value={`${gbp.format(venue.priceFrom)} - ${gbp.format(venue.priceTo)}`} />
            <InfoTile title="Capacity" value={formatCapacity(venue.capacityMin, venue.capacityMax)} />
            <InfoTile title="Location" value={`${venue.town}, Scotland`} />
          </section>

          <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
            <h2 className="font-display text-3xl font-semibold">Amenities</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {venue.amenities.map((amenity) => (
                <div className="flex items-center gap-3 text-sm text-[#4f4a43]" key={amenity.id}>
                  <span className="grid size-8 place-items-center rounded-full bg-[#f4efe7] text-[#8b6d3c]">
                    <Check size={16} />
                  </span>
                  {amenity.name}
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[#dfe6df]">
            <div className="grid min-h-72 place-items-center p-8 text-center">
              <div>
                <MapPin className="mx-auto text-[#6d795f]" size={32} />
                <h2 className="mt-4 font-display text-3xl font-semibold">Map preview</h2>
                <p className="mt-2 text-sm text-[#5f6957]">Interactive map integration placeholder for {venue.town}.</p>
              </div>
            </div>
          </section>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <EnquiryForm venueId={venue.id} />
        </aside>
      </div>
    </article>
  );
}

function InfoTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a806f]">{title}</p>
      <p className="mt-3 flex items-center gap-2 text-lg font-semibold">
        {title === "Capacity" ? <UsersRound size={17} className="text-[#9d7b45]" /> : null}
        {value}
      </p>
    </div>
  );
}
