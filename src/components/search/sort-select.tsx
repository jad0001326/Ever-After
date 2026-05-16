"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/field";

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      aria-label="Sort venues"
      className="max-w-56"
      defaultValue={searchParams.get("sort") ?? "price-asc"}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", event.target.value);
        params.delete("page");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      <option value="price-asc">Price low-high</option>
      <option value="price-desc">Price high-low</option>
      <option value="capacity-desc">Guest capacity</option>
    </Select>
  );
}
