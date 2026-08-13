"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, ImageIcon, MapPin, UsersRound, X } from "lucide-react";
import { formatMoney } from "@/lib/budget/calculations";
import type { PlanningHubVenueDetail } from "@/lib/planning-hub/types";
import { VenuePassport } from "@/components/venue/venue-passport";

export function PlanningHubVenueDetailPanel({
  detail,
  loading,
  onClose
}: {
  detail: PlanningHubVenueDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!loading && !detail) return null;

  return (
    <section
      aria-busy={loading}
      aria-label={loading ? "Loading venue details" : `${detail?.name ?? "Venue"} details`}
      aria-live="polite"
      className="focus-ring mb-6 scroll-mt-24 overflow-hidden rounded-3xl border border-[#cfc3b3] bg-white"
      id="venue-detail"
      tabIndex={-1}
    >
      {loading ? (
        <div className="grid min-h-80 place-items-center p-8 text-center">
          <div>
            <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-[#d9d0c3] border-t-[#173526]" />
            <p className="mt-4 text-sm font-semibold text-[#514b43]">Opening venue details…</p>
          </div>
        </div>
      ) : detail ? (
        <>
          <div className="relative aspect-[16/9] bg-[#eee8dd]">
            {detail.hasApprovedPhoto ? (
              <Image alt={detail.gallery[0].alt} className="object-cover" fill priority sizes="(min-width: 1024px) 55vw, 100vw" src={detail.gallery[0].url} />
            ) : (
              <VenuePassport className="h-full w-full rounded-none" venue={detail} />
            )}
            <button aria-label="Close venue details" className="focus-ring absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-white/95 text-[#173526] shadow-lg" onClick={onClose} type="button">
              <X size={20} />
            </button>
            {!detail.hasApprovedPhoto ? <span className="absolute bottom-4 left-4 rounded-full bg-[#fff9ef] px-3 py-1.5 text-xs font-semibold text-[#715622]">EverAft illustrated profile</span> : null}
          </div>
          <div className="p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9c542d]">{detail.type}</p>
            <h2 className="mt-2 font-display text-4xl font-semibold leading-none text-[#173526]">{detail.name}</h2>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#625f57]">
              <span className="inline-flex items-center gap-1.5"><MapPin size={16} /> {detail.town}, {detail.region}</span>
              <span className="inline-flex items-center gap-1.5"><UsersRound size={16} /> {detail.capacityMin}–{detail.capacityMax} guests</span>
              <span className="font-semibold text-[#173526]">{detail.priceFromPence == null ? "Pricing being confirmed" : `${detail.pricingLabel ?? "Planning price"} from ${formatMoney(detail.priceFromPence)}`}</span>
            </div>
            <p className="mt-5 text-sm leading-7 text-[#514b43]">{detail.description}</p>
            {detail.amenities.length ? (
              <ul className="mt-5 flex flex-wrap gap-2" aria-label="Venue amenities">
                {detail.amenities.map((amenity) => <li className="rounded-full bg-[#f4efe7] px-3 py-1.5 text-xs font-medium text-[#5e5549]" key={amenity}>{amenity}</li>)}
              </ul>
            ) : null}
            {detail.gallery.length > 1 ? (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {detail.gallery.slice(1, 4).map((image) => (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#eee8dd]" key={image.id}>
                    <Image alt={image.alt} className="object-cover" fill sizes="(min-width: 640px) 18vw, 45vw" src={image.url} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 inline-flex items-center gap-2 text-xs text-[#715622]"><ImageIcon size={15} /> Approved venue photography has not been supplied yet.</p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="focus-ring inline-flex min-h-11 items-center rounded-full border border-[#173526] px-5 text-sm font-semibold text-[#173526]" href={`/venues/${detail.slug}`} prefetch={false}>
                Full venue page
              </Link>
              {detail.officialWebsiteUrl ? (
                <a className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-[#173526] px-5 text-sm font-semibold text-white" href={detail.officialWebsiteUrl} rel="noopener noreferrer" target="_blank">
                  Venue website <ExternalLink size={15} />
                </a>
              ) : null}
            </div>
            {detail.imageCredit ? <p className="mt-4 text-[11px] text-[#766f66]">Image credit: {detail.imageCredit}</p> : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
