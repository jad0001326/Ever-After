import Image from "next/image";
import Link from "next/link";
import { MapPin, UsersRound } from "lucide-react";
import type { Venue } from "@/types/venue";
import { formatCapacity, gbp } from "@/lib/utils";

export function VenueCard({ venue, priority = false }: { venue: Venue; priority?: boolean }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-[var(--line)] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10">
      <Link href={`/venues/${venue.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#eee8dd]">
          <Image
            alt={venue.name}
            className="object-cover transition duration-700 group-hover:scale-105"
            fill
            priority={priority}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            src={venue.heroImage}
          />
          <div className="absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-[#3d372f] backdrop-blur">
            {venue.type}
          </div>
          {venue.isClaimed ? (
            <div className="absolute bottom-4 left-4 rounded-full border border-white/50 bg-white/88 px-3 py-1 text-[11px] font-semibold text-[#3f5c35] backdrop-blur">
              Managed by venue
            </div>
          ) : venue.imageIsRepresentative ? (
            <div className="absolute bottom-4 left-4 rounded-full border border-white/50 bg-white/86 px-3 py-1 text-[11px] font-medium text-[#5c554a] backdrop-blur">
              Representative image
            </div>
          ) : null}
        </div>
        <div className="grid gap-4 p-5">
          <div>
            <h3 className="font-display text-2xl font-semibold">{venue.name}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{venue.summary}</p>
          </div>
          <div className="grid gap-2 text-sm text-[#4f4a43]">
            <span className="flex items-center gap-2">
              <MapPin size={16} className="text-[#9d7b45]" />
              {venue.town}, {venue.region}
            </span>
            <span className="flex items-center gap-2">
              <UsersRound size={16} className="text-[#9d7b45]" />
              {formatCapacity(venue.capacityMin, venue.capacityMax)}
            </span>
          </div>
          <div className="flex items-end justify-between border-t border-[var(--line)] pt-4">
            <span className="text-xs uppercase tracking-[0.18em] text-[#8a806f]">From</span>
            <span className="text-lg font-semibold">{gbp.format(venue.priceFrom)}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
