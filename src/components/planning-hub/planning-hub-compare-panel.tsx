"use client";

import { Scale, X } from "lucide-react";
import { formatMoney } from "@/lib/budget/calculations";
import type { PlanningHubVenue } from "@/lib/planning-hub/types";

export function PlanningHubComparePanel({
  venues,
  onRemove
}: {
  venues: PlanningHubVenue[];
  onRemove: (venueId: string) => void;
}) {
  if (venues.length === 0) return null;

  return (
    <section aria-live="polite" className="mb-6 rounded-3xl border border-[#d5b898] bg-[#fff9ef] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#9c542d]"><Scale size={15} /> Venue comparison</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-[#173526]">{venues.length < 2 ? "Choose one more venue" : "Compare your strongest options"}</h2>
        </div>
        <p className="text-xs text-[#625f57]">{venues.length} of 3 selected</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {venues.map((venue) => (
          <article className="min-w-0 rounded-2xl border border-[#ded2c2] bg-white p-4" key={venue.id}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-xl font-semibold leading-tight text-[#173526]">{venue.name}</h3>
              <button aria-label={`Remove ${venue.name} from comparison`} className="focus-ring grid size-9 shrink-0 place-items-center rounded-full text-[#7d6a55] hover:bg-[#f4efe7]" onClick={() => onRemove(venue.id)} type="button"><X size={16} /></button>
            </div>
            <dl className="mt-4 grid gap-3 text-xs">
              <div><dt className="text-[#625f57]">Location</dt><dd className="mt-1 font-semibold text-[#403b35]">{venue.town}, {venue.region}</dd></div>
              <div><dt className="text-[#625f57]">Capacity</dt><dd className="mt-1 font-semibold text-[#403b35]">Up to {venue.capacityMax} guests</dd></div>
              <div><dt className="text-[#625f57]">Planning price</dt><dd className="mt-1 font-semibold text-[#403b35]">{venue.priceFromPence == null ? "Confirm with venue" : `From ${formatMoney(venue.priceFromPence)}`}</dd></div>
              <div><dt className="text-[#625f57]">Photography</dt><dd className="mt-1 font-semibold text-[#403b35]">{venue.hasApprovedPhoto ? "Venue-approved" : "Illustrated profile"}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
