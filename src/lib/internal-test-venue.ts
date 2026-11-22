export const INTERNAL_TEST_VENUE_SLUG_PREFIX = "everaft-internal-test-";
const INTERNAL_TEST_VENUE_NAME_PREFIX = "everaft internal test";
const INTERNAL_TEST_VENUE_REGION = "internal qa";

export function isInternalTestVenueSlug(slug: string) {
  return slug.startsWith(INTERNAL_TEST_VENUE_SLUG_PREFIX);
}

export function isInternalTestVenueRecord(venue: {
  slug?: string | null;
  name?: string | null;
  region?: string | null;
}) {
  if (venue.slug && isInternalTestVenueSlug(venue.slug)) return true;
  const name = venue.name?.trim().toLowerCase() ?? "";
  const region = venue.region?.trim().toLowerCase() ?? "";
  return name.startsWith(INTERNAL_TEST_VENUE_NAME_PREFIX) || region === INTERNAL_TEST_VENUE_REGION;
}

type InternalVenueFilter = {
  not(column: string, operator: string, value: string): InternalVenueFilter;
  neq(column: string, value: string): InternalVenueFilter;
};

export function withoutInternalTestVenues<T>(query: T): T {
  const filter = query as unknown as InternalVenueFilter;
  return filter
    .not("slug", "like", `${INTERNAL_TEST_VENUE_SLUG_PREFIX}%`)
    .not("name", "ilike", "EverAft Internal Test%")
    .neq("region", "Internal QA") as unknown as T;
}
