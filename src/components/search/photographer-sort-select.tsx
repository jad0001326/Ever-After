"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/field";

export function PhotographerSortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <Select aria-label="Sort photographers" className="max-w-56" defaultValue={searchParams.get("sort") ?? "price-asc"} onChange={(event) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", event.target.value);
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }}>
      <option value="price-asc">Lowest starting price</option>
      <option value="price-desc">Highest starting price</option>
      <option value="name">Name A–Z</option>
      <option value="newest">Recently updated</option>
    </Select>
  );
}

