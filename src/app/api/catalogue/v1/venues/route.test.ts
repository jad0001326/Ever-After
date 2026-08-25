import { beforeEach, describe, expect, it, vi } from "vitest";

const searchVenues = vi.fn();
vi.mock("@/lib/planning-hub/venues", () => ({
  searchPlanningHubVenues: (...args: unknown[]) => searchVenues(...args),
}));

import { GET } from "./route";

describe("Venue catalogue collection API", () => {
  beforeEach(() => {
    searchVenues.mockReset();
    searchVenues.mockResolvedValue({
      venues: [venue()],
      total: 9,
      page: 1,
      totalPages: 2,
    });
  });

  it("returns a public, versioned, eight-result contract", async () => {
    const response = await GET(new Request(
      "https://www.everaft.co.uk/api/catalogue/v1/venues?location=Fife&page=1",
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(response.headers.get("x-everaft-contract")).toContain("venue-collection:v1");
    expect(body.page).toEqual({ number: 1, size: 8, total: 9, totalPages: 2 });
    expect(body.venues[0].imageStatus).toBe("approved");
    expect(searchVenues).toHaveBeenCalledWith({ location: "Fife", page: "1" });
  });

  it("rejects private context, duplicate values and excessive pages", async () => {
    for (const query of ["workspace=secret", "page=1&page=2", "page=1001"]) {
      const response = await GET(new Request(
        `https://www.everaft.co.uk/api/catalogue/v1/venues?${query}`,
      ));
      expect(response.status).toBe(400);
    }
    expect(searchVenues).not.toHaveBeenCalled();
  });
});

function venue() {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "venue-one",
    name: "Venue One",
    type: "Castle",
    town: "Cupar",
    region: "Fife",
    summary: "A venue.",
    capacityMax: 120,
    imageUrl: "https://images.example/venue.jpg",
    imageStatus: "approved",
    hasApprovedPhoto: true,
    priceFromPence: 500_000,
    pricingLabel: "From",
    pricingUnit: "total",
  };
}
