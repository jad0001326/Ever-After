import type { VenueSearchParams } from "@/types/venue";

export function buildVenueHref(params: VenueSearchParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return `/venues${query ? `?${query}` : ""}`;
}
