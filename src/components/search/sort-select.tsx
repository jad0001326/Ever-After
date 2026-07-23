"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/ui/field";
import type { VenueSearchParams } from "@/types/venue";

export function SortSelect({ params: initialParams }: { params: VenueSearchParams }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Select
      aria-label="Sort venues"
      className="max-w-56"
      defaultValue={initialParams.sort ?? "price-asc"}
      onChange={(event) => {
        const params = new URLSearchParams();
        Object.entries(initialParams).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });
        params.set("sort", event.target.value);
        params.delete("page");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      <option value="price-asc">Lowest confirmed price</option>
      <option value="price-desc">Highest confirmed price</option>
      <option value="capacity-desc">Guest capacity</option>
    </Select>
  );
}
