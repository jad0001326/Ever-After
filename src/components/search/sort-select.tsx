"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/field";

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      aria-label="Sort venues, with featured listings first"
      className="max-w-64"
      defaultValue={searchParams.get("sort") ?? "price-asc"}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
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
