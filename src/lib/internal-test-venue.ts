export const INTERNAL_TEST_VENUE_SLUG_PREFIX = "everaft-internal-test-";

export function isInternalTestVenueSlug(slug: string) {
  return slug.startsWith(INTERNAL_TEST_VENUE_SLUG_PREFIX);
}
