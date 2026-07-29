import Link from "next/link";
import type { ReactNode } from "react";
import { Camera, SlidersHorizontal } from "lucide-react";
import { photographerStyles } from "@/data/supplier-directory";
import { formatMoney } from "@/lib/budget/calculations";
import {
  getPlanningHubSupplierResetHref,
  type PlanningHubDerivedSupplierFilters,
} from "@/lib/planning-hub/supplier-search";
import type { PlanningHubPhotographySearchParams } from "@/lib/planning-hub/types";

export function PlanningHubPhotographyFilters({
  derivedFilters,
  params,
  remainingPence,
  selectedVenueName,
  weddingDate
}: {
  derivedFilters: PlanningHubDerivedSupplierFilters;
  params: PlanningHubPhotographySearchParams;
  remainingPence: number;
  selectedVenueName: string | null;
  weddingDate: string | null;
}) {
  const hasFilters = Boolean(
    params.search
    || params.style
    || params.sort
    || (!derivedFilters.location && params.location)
    || (!derivedFilters.budget && params.budget)
  );

  return (
    <aside aria-label="Photography filters" className="self-start rounded-3xl border border-[#cfc3b3] bg-white p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9c542d]">Photography match</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-[#173526]">Refine</h2>
        </div>
        <SlidersHorizontal className="text-[#7a6d59]" size={18} />
      </div>

      <div className="mt-5 rounded-2xl bg-[#e8efe8] p-4 text-xs leading-5 text-[#415348]">
        <p className="font-semibold text-[#173526]">Planning context</p>
        <ul className="mt-2 grid gap-1">
          <li>{selectedVenueName ? `Venue: ${selectedVenueName}` : "Venue not chosen yet"}</li>
          <li>{weddingDate ? `Date: ${formatDate(weddingDate)}` : "Date not set yet"}</li>
          <li>{formatMoney(Math.max(remainingPence, 0))} remaining overall</li>
        </ul>
      </div>

      <form action="/planning-hub/photography" className="mt-5 grid gap-4">
        {params.workspace ? <input name="workspace" type="hidden" value={params.workspace} /> : null}
        {params.context ? <input name="context" type="hidden" value={params.context} /> : null}
        {params.venue ? <input name="venue" type="hidden" value={params.venue} /> : null}
        {params.venueName ? <input name="venueName" type="hidden" value={params.venueName} /> : null}
        {params.planDate ? <input name="planDate" type="hidden" value={params.planDate} /> : null}
        {params.planLocation ? <input name="planLocation" type="hidden" value={params.planLocation} /> : null}
        {params.remainingPence ? <input name="remainingPence" type="hidden" value={params.remainingPence} /> : null}
        <Field label="Photographer name">
          <input className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] px-3 text-sm" defaultValue={params.search ?? ""} maxLength={120} name="search" placeholder="Search by name" />
        </Field>
        <Field label="Location">
          <input aria-describedby={derivedFilters.location ? "photography-location-source" : undefined} aria-label="Location" className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] px-3 text-sm" defaultValue={params.location ?? ""} maxLength={120} name="location" placeholder="Region or town" />
          {derivedFilters.location ? <span className="font-normal leading-5 text-[#625f57]" id="photography-location-source">From your Wedding Profile. Change it here to search somewhere else.</span> : null}
        </Field>
        <Field label="Photography style">
          <select className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] bg-white px-3 text-sm" defaultValue={params.style ?? ""} name="style">
            <option value="">All styles</option>
            {photographerStyles.map((style) => <option key={style} value={style}>{style}</option>)}
          </select>
        </Field>
        <Field label="Photography budget">
          <span className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#625f57]">£</span>
            <input aria-describedby={derivedFilters.budget ? "photography-budget-source" : undefined} aria-label="Photography budget" className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] pl-7 pr-3 text-sm" defaultValue={params.budget ?? ""} inputMode="decimal" min={0} name="budget" placeholder="2000" step="1" type="number" />
          </span>
          {derivedFilters.budget ? <span className="font-normal leading-5 text-[#625f57]" id="photography-budget-source">Using the amount remaining in your connected plan. Change it to set a photography-specific limit.</span> : null}
        </Field>
        <Field label="Sort">
          <select className="focus-ring min-h-11 w-full rounded-xl border border-[#cfc3b3] bg-white px-3 text-sm" defaultValue={params.sort ?? ""} name="sort">
            <option value="">Best match</option>
            <option value="price-asc">Lowest known price</option>
            <option value="price-desc">Highest known price</option>
            <option value="name">Name</option>
            <option value="newest">Recently updated</option>
          </select>
        </Field>
        <button className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173526] px-4 text-sm font-semibold text-white" type="submit">
          <Camera size={16} /> Find photographers
        </button>
        {hasFilters ? (
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cfc3b3] px-4 text-sm font-semibold text-[#173526]" href={getPlanningHubSupplierResetHref("/planning-hub/photography", params)} prefetch={false}>
            Reset filters
          </Link>
        ) : null}
      </form>
      <p className="mt-4 text-xs leading-5 text-[#625f57]">Quote-only photographers remain visible so you can request pricing and enter your own working estimate.</p>
    </aside>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-[#514b43]">{label}{children}</label>;
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
