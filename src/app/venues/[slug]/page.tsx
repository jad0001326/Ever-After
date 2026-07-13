import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, Camera, Check, ExternalLink, Globe2, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { EnquiryForm } from "@/components/venue/enquiry-form";
import { FavouriteButton } from "@/components/venue/favourite-button";
import { VenueGallery } from "@/components/venue/venue-gallery";
import { VenuePricingSection } from "@/components/venue/venue-pricing-section";
import { ButtonLink } from "@/components/ui/button";
import { buildBreadcrumbSchema, buildMetadata } from "@/lib/seo";
import { getPrimaryVenuePriceDisplay } from "@/lib/venue-pricing";
import { absoluteUrl, formatCapacity } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getVenueListingBySlug } from "@/lib/venues";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenueListingBySlug(slug);
  if (!venue) return {};

  return buildMetadata({
    title: `${venue.name} wedding venue, ${venue.town}`,
    description: venue.summary,
    path: `/venues/${venue.slug}`,
    image: venue.heroImage,
    keywords: [
      `${venue.name} wedding venue`,
      `${venue.town} wedding venue`,
      `${venue.type} wedding venue Scotland`
    ]
  });
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

  const price = getPrimaryVenuePriceDisplay(venue.priceOptions);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${venue.town}, ${venue.region}, Scotland`)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "EventVenue"],
    additionalType: "https://schema.org/WeddingVenue",
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
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Venues", path: "/venues" },
    { name: venue.name, path: `/venues/${venue.slug}` }
  ]);

  return (
    <article className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Venues", href: "/venues" }, { label: venue.name, href: `/venues/${venue.slug}` }]} />
      <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9d7b45]">{venue.type}</p>
            {venue.isClaimed ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#eef4ea] px-3 py-1 text-xs font-semibold text-[#3f5c35] ring-1 ring-[#d7e3d2]">
                <ShieldCheck size={14} /> Managed by venue
              </span>
            ) : null}
          </div>
          <h1 className="mt-3 font-display text-5xl font-semibold sm:text-6xl">{venue.name}</h1>
          <p className="mt-3 flex items-center gap-2 text-[var(--muted)]">
            <MapPin size={17} /> {venue.town}, {venue.region}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="#enquiry">
              Check availability
            </ButtonLink>
            <ButtonLink href={`/wedding-budget-planner?venue=${encodeURIComponent(venue.id)}`} variant="secondary">
              Add venue to budget <Calculator size={16} />
            </ButtonLink>
            {venue.officialWebsiteUrl ? (
              <ButtonLink href={venue.officialWebsiteUrl} target="_blank" rel="noopener noreferrer" variant="secondary">
                Official website <ExternalLink size={16} />
              </ButtonLink>
            ) : null}
            {venue.officialGalleryUrl ? (
              <ButtonLink href={venue.officialGalleryUrl} target="_blank" rel="noopener noreferrer" variant="secondary">
                Gallery <Camera size={16} />
              </ButtonLink>
            ) : null}
          </div>
        </div>
        <FavouriteButton initialSaved={Boolean(favourite?.data)} venueId={venue.id} />
      </div>

      <VenueGallery venue={venue} />
      <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-[var(--line)] bg-white/72 px-5 py-4 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>{venue.imageIsRepresentative ? "Representative imagery is shown until venue-approved photography is available." : "Venue imagery has been reviewed for this listing."}</p>
        {venue.officialGalleryUrl ? (
          <ButtonLink href={venue.officialGalleryUrl} target="_blank" rel="noopener noreferrer" variant="secondary" className="shrink-0">
            View official gallery <ExternalLink size={16} />
          </ButtonLink>
        ) : null}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-8">
          <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
            <h2 className="font-display text-3xl font-semibold">About the venue</h2>
            <p className="mt-4 text-base leading-8 text-[var(--muted)]">{venue.description}</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link className="font-semibold text-[#5c6b52] hover:underline" href={`/venues?location=${encodeURIComponent(venue.town)}`}>
                Explore more venues in {venue.town}
              </Link>
              <Link className="font-semibold text-[#5c6b52] hover:underline" href={`/venues?type=${encodeURIComponent(venue.type)}`}>
                Browse more {venue.type.toLowerCase()} venues
              </Link>
            </div>
          </section>

          <VenuePricingSection priceOptions={venue.priceOptions} />

          <section className="grid gap-4 sm:grid-cols-3">
            <InfoTile
              title="Pricing"
              value={price ? [price.amountLabel, ...price.materialQualifierLabels].join(" · ") : "Ask venue for current pricing"}
            />
            <InfoTile title="Capacity" value={formatCapacity(venue.capacityMin, venue.capacityMax)} />
            <InfoTile title="Location" value={`${venue.town}, Scotland`} />
          </section>

          <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
            <h2 className="font-display text-3xl font-semibold">Amenities</h2>
            {venue.amenities.length > 0 ? (
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
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Amenities are being confirmed with the venue.</p>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9d7b45]">Location</p>
                <h2 className="mt-3 font-display text-3xl font-semibold">{venue.town}, {venue.region}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Open the venue location in Google Maps for directions and nearby travel planning.</p>
              </div>
              <ButtonLink href={mapsHref} target="_blank" rel="noopener noreferrer" variant="secondary" className="shrink-0">
                Open in Google Maps <ExternalLink size={16} />
              </ButtonLink>
            </div>
          </section>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="mb-5 rounded-3xl border border-[var(--line)] bg-white p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9d7b45]">Listing confidence</p>
            <div className="mt-4 grid gap-3 text-sm text-[#4f4a43]">
              <TrustRow icon={<ShieldCheck size={16} />} text={venue.isClaimed ? "Managed by the venue team" : "Open for venue owner verification"} />
              <TrustRow icon={<Camera size={16} />} text={venue.imageIsRepresentative ? "Representative imagery in use" : "Reviewed venue imagery"} />
              {venue.officialWebsiteUrl ? <TrustRow icon={<Globe2 size={16} />} text="Official website linked" /> : null}
            </div>
          </section>
          {!venue.isClaimed ? (
            <section className="mb-5 rounded-3xl border border-[#d7c49d] bg-[#fff9ef] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9d7b45]">Own or manage this venue?</p>
              <h2 className="mt-3 font-display text-3xl font-semibold">Claim this listing</h2>
              <p className="mt-2 text-sm leading-6 text-[#6a5b42]">Verify your connection to update details, submit approved photography, and manage listing requests.</p>
              <ButtonLink className="mt-5 w-full" href={`/venues/${venue.slug}/claim`}>
                Claim this listing
              </ButtonLink>
            </section>
          ) : null}
          <div id="enquiry">
            <EnquiryForm venueId={venue.id} />
          </div>
        </aside>
      </div>
    </article>
  );
}

function TrustRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f4efe7] text-[#8b6d3c]">{icon}</span>
      <span>{text}</span>
    </div>
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
