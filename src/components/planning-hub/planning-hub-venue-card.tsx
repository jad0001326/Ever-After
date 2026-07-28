"use client";

import Image from "next/image";
import { Check, Eye, Heart, Scale, UsersRound } from "lucide-react";
import { formatMoney } from "@/lib/budget/calculations";
import type { PlanningHubVenue } from "@/lib/planning-hub/types";

export function PlanningHubVenueCard({
  venue,
  bookingStatus,
  chosen,
  compared,
  saved,
  priority,
  onCompare,
  onOpen,
  onSave
}: {
  venue: PlanningHubVenue;
  bookingStatus: string | null;
  chosen: boolean;
  compared: boolean;
  saved: boolean;
  priority: boolean;
  onCompare: () => void;
  onOpen: () => void;
  onSave: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-[#d9d0c3] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/5">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#eee8dd]">
        <Image
          alt={venue.hasApprovedPhoto ? `${venue.name} wedding venue in ${venue.town}` : `${venue.name} illustrated venue profile`}
          className="object-cover transition duration-500 group-hover:scale-[1.02]"
          fill
          priority={priority}
          sizes="(min-width: 1280px) 28vw, (min-width: 640px) 44vw, 100vw"
          src={venue.imageUrl}
        />
        <div className="absolute inset-x-3 top-3 flex flex-wrap justify-between gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#3d372f]">{venue.type}</span>
          {chosen ? <span className="inline-flex items-center gap-1 rounded-full bg-[#173526] px-3 py-1 text-[11px] font-semibold text-white"><Check size={13} /> Chosen venue</span> : null}
        </div>
        {!venue.hasApprovedPhoto ? <span className="absolute bottom-3 left-3 rounded-full bg-[#fff9ef] px-3 py-1 text-[10px] font-semibold text-[#715622]">Illustrated profile</span> : null}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-semibold leading-tight text-[#173526]">{venue.name}</h3>
            <p className="mt-1 text-xs text-[#625f57]">{venue.town}, {venue.region}</p>
          </div>
          {bookingStatus ? <span className="rounded-full bg-[#e8efe8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#24432f]">{bookingStatus.replaceAll("_", " ")}</span> : null}
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#625f57]">{venue.summary}</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-[#e4ddd2] pt-4">
          <span>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-[#625f57]">{venue.pricingLabel ?? "Planning price"}</span>
            <span className="font-semibold text-[#2f3d32]">{venue.priceFromPence == null ? "Pricing being confirmed" : `From ${formatMoney(venue.priceFromPence)}`}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#625f57]"><UsersRound size={15} /> Up to {venue.capacityMax}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button aria-pressed={saved} className={`focus-ring inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border text-xs font-semibold ${saved ? "border-[#173526] bg-[#e8efe8] text-[#173526]" : "border-[#d9d0c3] text-[#514b43]"}`} onClick={onSave} type="button">
            <Heart fill={saved ? "currentColor" : "none"} size={15} /> {saved ? "Saved" : "Save"}
          </button>
          <button aria-pressed={compared} className={`focus-ring inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border text-xs font-semibold ${compared ? "border-[#9c542d] bg-[#fff2ea] text-[#873f20]" : "border-[#d9d0c3] text-[#514b43]"}`} onClick={onCompare} type="button">
            <Scale size={15} /> Compare
          </button>
          <button className="focus-ring inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[#173526] px-2 text-xs font-semibold text-white" onClick={onOpen} type="button">
            <Eye size={15} /> View
          </button>
        </div>
      </div>
    </article>
  );
}
