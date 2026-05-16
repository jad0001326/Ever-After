"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { venueTypes } from "@/data/venues";
import { Field, Input, Select } from "@/components/ui/field";

export function FilterPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <aside className="rounded-3xl border border-[var(--line)] bg-white p-5 lg:sticky lg:top-24">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Refine</h2>
        <SlidersHorizontal size={18} className="text-[#7a6d59]" />
      </div>
      <div className="grid gap-4">
        <Field label="Location">
          <Input
            defaultValue={searchParams.get("location") ?? ""}
            onChange={(event) => update("location", event.target.value)}
            placeholder="Region or town"
          />
        </Field>
        <Field label="Guest count">
          <Input
            defaultValue={searchParams.get("guests") ?? ""}
            min="1"
            onChange={(event) => update("guests", event.target.value)}
            placeholder="120"
            type="number"
          />
        </Field>
        <Field label="Budget">
          <Input
            defaultValue={searchParams.get("budget") ?? ""}
            min="0"
            onChange={(event) => update("budget", event.target.value)}
            placeholder="12000"
            type="number"
          />
        </Field>
        <Field label="Venue type">
          <Select defaultValue={searchParams.get("type") ?? ""} onChange={(event) => update("type", event.target.value)}>
            <option value="">All venue types</option>
            {venueTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </aside>
  );
}
