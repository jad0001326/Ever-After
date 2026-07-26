"use client";

import Image from "next/image";
import { Check, Eye, MapPin, Scale } from "lucide-react";
import { formatMoney } from "@/lib/budget/calculations";
import type { PlanningHubPhotographer } from "@/lib/planning-hub/types";

export function PlanningHubPhotographerCard({
  photographer,
  bookingStatus,
  compared,
  priority,
  onCompare,
  onOpen
}: {
  photographer: PlanningHubPhotographer;
  bookingStatus: string | null;
  compared: boolean;
  priority: boolean;
  onCompare: () => void;
  onOpen: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-[#d9d0c3] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/5">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#eee8dd]">
        <Image
          alt={photographer.hasApprovedPhoto ? `${photographer.name} wedding photography` : `${photographer.name} photographer profile`}
          className={photographer.hasApprovedPhoto ? "object-cover transition duration-500 group-hover:scale-[1.02]" : "object-contain p-12"}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 28vw, (min-width: 640px) 44vw, 100vw"
          src={photographer.heroImageUrl}
        />
        <div className="absolute inset-x-3 top-3 flex flex-wrap justify-between gap-2">
          <span className="rounded-full bg-white/92 px-3 py-1 text-[11px] font-semibold text-[#3d372f] backdrop-blur">Photographer</span>
          {bookingStatus ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#173526] px-3 py-1 text-[11px] font-semibold capitalize text-white">
              <Check size={13} /> {bookingStatus.replaceAll("_", " ")}
            </span>
          ) : null}
        </div>
        {!photographer.hasApprovedPhoto ? <span className="absolute bottom-3 left-3 rounded-full bg-[#fff9ef]/95 px-3 py-1 text-[10px] font-semibold text-[#715622]">Profile image pending</span> : null}
      </div>
      <div className="p-5">
        <h3 className="font-display text-2xl font-semibold leading-tight text-[#173526]">{photographer.name}</h3>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[#625f57]"><MapPin size={14} /> {photographer.baseTown}, {photographer.region}{photographer.travelsNationwide ? " · travels nationwide" : ""}</p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#625f57]">{photographer.summary}</p>
        {photographer.styles.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {photographer.styles.slice(0, 3).map((style) => <span className="rounded-full bg-[#f4efe7] px-2.5 py-1 text-[11px] font-medium text-[#665a4b]" key={style}>{style}</span>)}
          </div>
        ) : null}
        <div className="mt-4 border-t border-[#e4ddd2] pt-4">
          <span className="block text-[10px] uppercase tracking-[0.16em] text-[#625f57]">Photography cost</span>
          <span className="font-semibold text-[#2f3d32]">
            {photographer.startingPricePence == null ? "Quote required" : `From ${formatMoney(photographer.startingPricePence)}`}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button aria-pressed={compared} className={`focus-ring inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border text-xs font-semibold ${compared ? "border-[#9c542d] bg-[#fff2ea] text-[#873f20]" : "border-[#d9d0c3] text-[#514b43]"}`} onClick={onCompare} type="button">
            <Scale size={15} /> Compare
          </button>
          <button className="focus-ring inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[#173526] px-2 text-xs font-semibold text-white" onClick={onOpen} type="button">
            <Eye size={15} /> View &amp; plan
          </button>
        </div>
      </div>
    </article>
  );
}
