import Image from "next/image";
import Link from "next/link";
import { Calculator, MapPin, UsersRound } from "lucide-react";
import type { Venue } from "@/types/venue";
import { getPrimaryVenuePriceDisplay } from "@/lib/venue-pricing";
import { formatCapacity } from "@/lib/utils";

export function VenueCard({ venue, priority = false }: { venue: Venue; priority?: boolean }) {
  const price = getPrimaryVenuePriceDisplay(venue.priceOptions);

  return (
    <article className="group h-full overflow-hidden rounded-3xl border border-[var(--line)] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10">
      <div className="grid h-full grid-rows-[auto_1fr]">
        <Link href={`/venues/${venue.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-[#eee8dd]">
          <Image
            alt={`${venue.name} wedding venue in ${venue.town}, Scotland`}
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
        </Link>
        <div className="flex h-full flex-col gap-4 p-5">
          <div>
            <h3 className="font-display text-2xl font-semibold"><Link className="focus-ring rounded-lg hover:text-[var(--brand)]" href={`/venues/${venue.slug}`}>{venue.name}</Link></h3>
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
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <span>{price ? <><span className="block text-[10px] uppercase tracking-[0.18em] text-[#8a806f]">{price.kindLabel}</span><span className="text-lg font-semibold">{price.amountLabel}</span>{price.materialQualifierLabels.length > 0 ? <span className="mt-1 block max-w-52 text-[11px] leading-4 text-[var(--muted)]">{price.materialQualifierLabels.join(" · ")}</span> : null}</> : <span className="text-xs text-[var(--muted)]">Pricing being confirmed</span>}</span>
            <Link className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-full bg-[#f4efe7] px-3 text-xs font-semibold text-[var(--brand)] transition hover:bg-[#e9dece]" href={`/wedding-budget-planner?venue=${encodeURIComponent(venue.id)}`}><Calculator size={15} /> Add to budget</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
