import { describe, expect, it } from "vitest";
import {
  getVenueCollectionForSearchParams,
  getVenueLocationCollection,
  getVenueTypeCollection
} from "@/lib/venue-collections";

describe("venue collection matching", () => {
  it("maps an exact curated filter to its canonical collection", () => {
    expect(getVenueCollectionForSearchParams({ location: "Glasgow" })?.slug).toBe("glasgow");
    expect(getVenueCollectionForSearchParams({ type: "Castle" })?.slug).toBe("castles");
  });

  it("does not canonicalise refined searches to a broad collection", () => {
    expect(getVenueCollectionForSearchParams({ location: "Glasgow", guests: "120" })).toBeUndefined();
  });

  it("finds relevant collections for venue internal links", () => {
    expect(getVenueLocationCollection({ town: "Glasgow", region: "Glasgow City" })?.slug).toBe("glasgow");
    expect(getVenueTypeCollection("Country Estate")?.slug).toBe("country-estates");
  });
});
