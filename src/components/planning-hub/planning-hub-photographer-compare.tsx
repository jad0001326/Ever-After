"use client";

import { Scale, X } from "lucide-react";
import { formatMoney } from "@/lib/budget/calculations";
import type { PlanningHubPhotographer } from "@/lib/planning-hub/types";

export function PlanningHubPhotographerCompare({
  photographers,
  onRemove
}: {
  photographers: PlanningHubPhotographer[];
  onRemove: (photographerId: string) => void;
}) {
  if (photographers.length === 0) return null;

  return (
    <section aria-label="Photographer comparison" className="mb-6 rounded-3xl border border-[#d9d0c3] bg-[#173526] p-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#d8c9ad]"><Scale size={15} /> Comparison</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">{photographers.length < 2 ? "Choose one more photographer" : "Compare your photography options"}</h2>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{photographers.length} of 3 selected</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {photographers.map((photographer) => (
          <article className="relative rounded-2xl bg-white p-4 text-[#173526]" key={photographer.id}>
            <button aria-label={`Remove ${photographer.name} from comparison`} className="focus-ring absolute right-2 top-2 inline-grid min-h-9 min-w-9 place-items-center rounded-full text-[#625f57]" onClick={() => onRemove(photographer.id)} type="button"><X size={16} /></button>
            <h3 className="pr-8 font-semibold">{photographer.name}</h3>
            <dl className="mt-3 grid gap-2 text-xs">
              <Row label="Based" value={`${photographer.baseTown}, ${photographer.region}`} />
              <Row label="Styles" value={photographer.styles.slice(0, 3).join(", ") || "Ask photographer"} />
              <Row label="Price" value={photographer.startingPricePence == null ? "Quote required" : `From ${formatMoney(photographer.startingPricePence)}`} />
              <Row label="Travel" value={photographer.travelsNationwide ? "Nationwide" : "Coverage varies"} />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7a6d59]">{label}</dt><dd className="mt-0.5 text-[#403b35]">{value}</dd></div>;
}
