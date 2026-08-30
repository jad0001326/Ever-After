import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.fn();
vi.mock("@/lib/planning-hub/photographers", () => ({ searchPlanningHubPhotographers: (...args: unknown[]) => search(...args) }));

import { GET } from "./route";

describe("Supplier catalogue collection API", () => {
  beforeEach(() => { search.mockReset(); search.mockResolvedValue({ photographers: [photographer()], total: 1, page: 1, totalPages: 1, venueContext: "matched" }); });

  it("returns bounded photography with truthful context and imagery", async () => {
    const response = await GET(new Request("https://www.everaft.co.uk/api/catalogue/v1/suppliers/photographer?venue=10000000-0000-4000-8000-000000000002&venueName=Venue%20One&weddingDate=2027-08-14"), { params: Promise.resolve({ category: "photographer" }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.page.size).toBe(8);
    expect(body.context).toMatchObject({ venue: "matched", venueName: "Venue One", weddingDate: "2027-08-14", availabilityStatus: "not_checked" });
    expect(body.suppliers[0]).toMatchObject({ visualStatus: "representative", availabilityStatus: "not_checked" });
  });

  it("denies dormant categories before querying", async () => {
    const response = await GET(new Request("https://www.everaft.co.uk/api/catalogue/v1/suppliers/florist"), { params: Promise.resolve({ category: "florist" }) });
    expect(response.status).toBe(404);
    expect(search).not.toHaveBeenCalled();
  });

  it("rejects impossible wedding dates before querying", async () => {
    const response = await GET(
      new Request("https://www.everaft.co.uk/api/catalogue/v1/suppliers/photographer?weddingDate=2026-99-99"),
      { params: Promise.resolve({ category: "photographer" }) },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_search" });
    expect(search).not.toHaveBeenCalled();
  });
});

function photographer() { return { id: "10000000-0000-4000-8000-000000000001", slug: "photo-one", name: "Photo One", baseTown: "Cupar", region: "Fife", summary: "Documentary photography.", styles: ["Documentary"], heroImageUrl: "/representative.jpg", hasApprovedPhoto: true, visualStatus: "representative", startingPricePence: 150_000, typicalPricePence: 220_000, pricingSummary: "Packages", pricingUnit: "event", isClaimed: false, travelsNationwide: false }; }
