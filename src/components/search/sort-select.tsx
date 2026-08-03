"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/ui/field";
import type { VenueSearchParams } from "@/types/venue";

export function SortSelect({ params: initialParams }: { params: VenueSearchParams }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Select
      aria-label="Sort venues, with featured listings first"
      className="max-w-64"
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
      <option value="price-asc">Featured first · lowest price</option>
      <option value="price-desc">Featured first · highest price</option>
      <option value="capacity-desc">Featured first · guest capacity</option>
    </Select>
  );
}
