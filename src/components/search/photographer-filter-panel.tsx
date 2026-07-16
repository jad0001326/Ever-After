"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { photographerStyles } from "@/data/supplier-directory";
import { Field, Input, Select } from "@/components/ui/field";
import type { PhotographerVenueOption } from "@/types/supplier";

export function PhotographerFilterPanel({ venues }: { venues: PhotographerVenueOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  const hasFilters = ["venue", "location", "style", "budget"].some((key) => searchParams.has(key));
  const venueGroups = new Map<string, PhotographerVenueOption[]>();
  for (const venue of venues) venueGroups.set(venue.region, [...(venueGroups.get(venue.region) ?? []), venue]);

  return (
    <aside className="rounded-3xl border border-[var(--line)] bg-white p-5 lg:sticky lg:top-24">
      <div className="mb-5 flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Refine</h2><SlidersHorizontal className="text-[#7a6d59]" size={18} /></div>
      <div className="grid gap-4">
        <Field label="Wedding venue"><Select defaultValue={searchParams.get("venue") ?? ""} onChange={(event) => update("venue", event.target.value)}><option value="">Venue not chosen</option>{[...venueGroups.entries()].map(([region, options]) => <optgroup key={region} label={region}>{options.map((venue) => <option key={venue.id} value={venue.id}>{venue.name} — {venue.town}</option>)}</optgroup>)}</Select></Field>
        <p className="-mt-2 text-xs leading-5 text-[var(--muted)]">Choose a venue to see photographers covering its area.</p>
        <Field label="Location"><Input defaultValue={searchParams.get("location") ?? ""} onChange={(event) => update("location", event.target.value)} placeholder="Region or town" /></Field>
        <Field label="Photography style"><Select defaultValue={searchParams.get("style") ?? ""} onChange={(event) => update("style", event.target.value)}><option value="">All styles</option>{photographerStyles.map((style) => <option key={style} value={style}>{style}</option>)}</Select></Field>
        <Field label="Package budget"><Input defaultValue={searchParams.get("budget") ?? ""} min="0" onChange={(event) => update("budget", event.target.value)} placeholder="2000" type="number" /></Field>
        {hasFilters ? <button className="focus-ring min-h-11 rounded-full bg-[#f4efe7] px-4 text-sm font-semibold text-[#3f4d38] transition hover:bg-[#e8dece]" onClick={() => router.replace(pathname, { scroll: false })} type="button">Clear filters</button> : null}
      </div>
    </aside>
  );
}
