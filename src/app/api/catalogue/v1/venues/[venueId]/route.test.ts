import { beforeEach, describe, expect, it, vi } from "vitest";

const getDetail = vi.fn();
vi.mock("@/lib/planning-hub/venues", () => ({
  getPlanningHubVenueDetail: (...args: unknown[]) => getDetail(...args),
}));

import { GET } from "./route";

describe("Venue catalogue detail API", () => {
  beforeEach(() => getDetail.mockReset());

  it("returns withdrawn or internal catalogue records as unavailable", async () => {
    getDetail.mockResolvedValue(null);
    const response = await GET(request(), context(validId));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "venue_not_found" });
  });

  it("does not query malformed direct ids", async () => {
    const response = await GET(request(), context("not-an-id"));
    expect(response.status).toBe(400);
    expect(getDetail).not.toHaveBeenCalled();
  });
});

const validId = "10000000-0000-4000-8000-000000000001";
function request() {
  return new Request(`https://www.everaft.co.uk/api/catalogue/v1/venues/${validId}`);
}
function context(venueId: string) {
  return { params: Promise.resolve({ venueId }) };
}
