import Image from "next/image";
import Link from "next/link";
import { ExternalLink, MapPin, UsersRound } from "lucide-react";
import { VenuePassport } from "@/components/venue/venue-passport";
import { shouldUseVenuePassport } from "@/lib/venue-images";
import { formatCapacity } from "@/lib/utils";
import type { Venue } from "@/types/venue";

export function VenueGallery({ venue }: { venue: Venue }) {
  const [hero, ...rest] = venue.images;
  const usesPassport = shouldUseVenuePassport(venue);

  if (usesPassport) {
    return (
      <section className="grid gap-3 lg:grid-cols-[1.45fr_1fr]">
        <VenuePassport className="min-h-72 lg:aspect-[5/3]" venue={venue} />
        <div className="flex min-h-72 flex-col rounded-3xl border border-[var(--line)] bg-[#f7f2ea] p-6 lg:min-h-0">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95502b]">EverAft venue profile</p>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-[0.94] tracking-[-0.035em]">{venue.name}</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            A considered visual guide to the venue while approved photography is being added.
          </p>
          <div className="mt-6 grid gap-3 border-y border-[var(--line)] py-5 text-sm text-[#4f4a43]">
            <span className="flex items-center gap-2"><MapPin aria-hidden="true" className="text-[#9d7b45]" size={16} />{venue.town}, {venue.region}</span>
            <span className="flex items-center gap-2"><UsersRound aria-hidden="true" className="text-[#9d7b45]" size={16} />{formatCapacity(venue.capacityMin, venue.capacityMax)}</span>
          </div>
          {venue.officialGalleryUrl ? (
            <Link
              className="focus-ring mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[var(--brand)] ring-1 ring-[var(--line)] transition hover:bg-[#f4efe7]"
              href={venue.officialGalleryUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              View official gallery <ExternalLink aria-hidden="true" size={16} />
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-3 lg:grid-cols-[1.45fr_1fr]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#eee8dd] lg:aspect-[5/3]">
        <Image alt={hero?.alt ?? venue.name} className="object-cover" fill priority sizes="(min-width: 1024px) 60vw, 100vw" src={hero?.url ?? venue.heroImage} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(rest.length ? rest : venue.images).slice(0, 4).map((image) => (
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-[#eee8dd]" key={image.id}>
            <Image alt={image.alt} className="object-cover" fill sizes="(min-width: 1024px) 20vw, 50vw" src={image.url} />
          </div>
        ))}
      </div>
    </section>
  );
}
