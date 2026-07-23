import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { venueTypes } from "@/data/venue-options";
import { Field, Input, Select } from "@/components/ui/field";
import type { PlanningHubSearchParams } from "@/lib/planning-hub/types";

export function PlanningHubFilters({
  params,
  resultCount
}: {
  params: PlanningHubSearchParams;
  resultCount: number;
}) {
  return (
    <aside className="self-start rounded-3xl border border-[#d9d0c3] bg-white lg:sticky lg:top-24">
      <details className="group" open>
        <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between px-5 lg:pointer-events-none">
          <span>
            <span className="block font-display text-2xl font-semibold text-[#173526]">Find your venue</span>
            <span className="text-xs text-[#625f57]">{resultCount} matching {resultCount === 1 ? "venue" : "venues"}</span>
          </span>
          <SlidersHorizontal className="text-[#9c542d] lg:hidden" size={18} />
        </summary>
        <form action="/planning-hub" className="grid gap-4 border-t border-[#e4ddd2] p-5" method="get">
          <Field label="Search">
            <Input defaultValue={params.search ?? ""} maxLength={100} name="search" placeholder="Venue, town or style" />
          </Field>
          <Field label="Location">
            <Input defaultValue={params.location ?? ""} maxLength={120} name="location" placeholder="Perthshire or St Andrews" />
          </Field>
          <Field label="Guest count">
            <Input defaultValue={params.guests ?? ""} inputMode="numeric" max={10000} min={1} name="guests" placeholder="80" type="number" />
          </Field>
          <Field label="Venue budget">
            <Input defaultValue={params.budget ?? ""} inputMode="numeric" max={10000000} min={1} name="budget" placeholder="8000" type="number" />
          </Field>
          <Field label="Venue type">
            <Select defaultValue={params.type ?? ""} name="type">
              <option value="">All venue types</option>
              {venueTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
          </Field>
          <button className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#173526] px-5 text-sm font-semibold text-white transition hover:bg-[#244f38]" type="submit">
            <Search size={17} /> Search venues
          </button>
          {Object.values(params).some(Boolean) ? (
            <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full text-sm font-semibold text-[#6b583e] underline underline-offset-4" href="/planning-hub">
              Clear filters
            </Link>
          ) : null}
        </form>
      </details>
    </aside>
  );
}
