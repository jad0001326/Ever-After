import { describe, expect, it } from "vitest";
import { catalogueVenueCollectionSchema } from "./venue-api-schema";

describe("venue catalogue contract", () => {
  it("rejects a ninth result and unknown private fields", () => {
    const venue = {
      id: "10000000-0000-4000-8000-000000000001",
      slug: "venue-one",
      name: "Venue One",
      type: "Castle",
      town: "Cupar",
      region: "Fife",
      summary: "A venue.",
      capacityMax: 120,
      imageUrl: null,
      imageStatus: "absent",
      priceFromPence: null,
      pricingLabel: null,
      pricingUnit: null,
    };
    const payload = {
      schemaVersion: 1,
      venues: Array.from({ length: 9 }, (_, index) => ({
        ...venue,
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      })),
      page: { number: 1, size: 8, total: 9, totalPages: 2 },
    };
    expect(catalogueVenueCollectionSchema.safeParse(payload).success).toBe(false);
    expect(catalogueVenueCollectionSchema.safeParse({
      ...payload,
      venues: [{ ...venue, ownerEmail: "private@example.test" }],
    }).success).toBe(false);
  });
});
