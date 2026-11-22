import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => createClient(...args)
}));

import { PUBLIC_CATALOGUE_ERROR } from "@/lib/catalogue-paging";
import { getVenueListingBySlug, searchVenueListings } from "@/lib/venues";

const NOTE = "Imported for EverAft launch review from public venue research; confirm copy, pricing, imagery, and permissions before publishing.";

describe("public venue search", () => {
  beforeEach(() => {
    createClient.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("publishes the venue sentence without the launch-review note", async () => {
    createClient.mockResolvedValue(client({
      range: { data: [venueRow()], count: 1, error: null }
    }));

    const results = await searchVenueListings({});

    expect(results.error).toBeUndefined();
    expect(results.venues[0]?.description).toBe("Beach Ballroom is a country estate in Aberdeen for weddings and private celebrations.");
    expect(results.venues[0]?.description).not.toContain("launch review");
    expect(results.page).toBe(1);
    expect(results.totalPages).toBe(1);
  });

  it("shows the last page when the requested page is past the end", async () => {
    const ranges: Array<[number, number]> = [];
    createClient.mockResolvedValue(client({
      range: (from, to) => {
        ranges.push([from, to]);
        if (from === 474) {
          return {
            data: null,
            count: 4,
            error: { code: "PGRST103", message: "Requested range not satisfiable", details: "An offset of 474 was requested, but there are only 4 rows." }
          };
        }
        return { data: [venueRow()], count: 4, error: null };
      }
    }));

    const results = await searchVenueListings({ page: "80" });

    expect(results.error).toBeUndefined();
    expect(results.outOfRange).toBe(true);
    expect(results.page).toBe(1);
    expect(results.totalPages).toBe(1);
    expect(results.total).toBe(4);
    expect(results.venues).toHaveLength(1);
    expect(JSON.stringify(results)).not.toContain("Requested range not satisfiable");
    expect(JSON.stringify(results)).not.toContain(NOTE);
    expect(ranges[0]).toEqual([474, 479]);
    expect(ranges[1]).toEqual([0, 5]);
  });

  it("never returns a raw database error to the page", async () => {
    createClient.mockResolvedValue(client({
      range: { data: null, count: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }
    }));

    const results = await searchVenueListings({ page: "2" });

    expect(results).toMatchObject({ venues: [], page: 1, totalPages: 1, error: PUBLIC_CATALOGUE_ERROR });
    expect(results.error).not.toContain("timeout");
  });

  it("does not publish an internal test listing by name or region", async () => {
    createClient.mockResolvedValue(client({
      single: {
        data: venueRow({
          slug: "qa-listing",
          name: "EverAft Internal Test Venue",
          town: "Test Listing",
          region: "Internal QA"
        }),
        error: null
      }
    }));

    await expect(getVenueListingBySlug("qa-listing")).resolves.toBeUndefined();
  });
});

function venueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "beach-ballroom",
    name: "Beach Ballroom",
    type: "Country Estate",
    region: "Aberdeen City",
    town: "Aberdeen",
    summary: "Beach Ballroom is a country estate in Aberdeen for weddings and private celebrations.",
    description: `Beach Ballroom is a country estate in Aberdeen for weddings and private celebrations. ${NOTE}`,
    price_from: null,
    price_to: null,
    capacity_min: 1,
    capacity_max: 120,
    hero_image: "https://images.example/beach.jpg",
    official_website_url: null,
    official_gallery_url: null,
    vendor_contact_email: null,
    listing_status: "published",
    claim_status: "unclaimed",
    image_permission_status: "representative",
    image_credit: null,
    image_is_representative: true,
    is_claimed: false,
    claimed_by: null,
    claimed_at: null,
    invite_sent_at: null,
    invite_status: "not_sent",
    latitude: null,
    longitude: null,
    is_featured: false,
    status: "published",
    ...overrides
  };
}

function client(options: {
  range?: { data: unknown; count: number | null; error: unknown } | ((from: number, to: number) => { data: unknown; count: number | null; error: unknown });
  single?: { data: unknown; error: unknown };
}) {
  return {
    from(table: string) {
      const query: Record<string, unknown> = {};
      const chain = () => query;
      for (const method of ["select", "eq", "in", "not", "neq", "or", "gte", "lte", "order"]) query[method] = vi.fn(chain);
      query.range = vi.fn(async (from: number, to: number) => {
        if (!options.range) return { data: null, count: 0, error: null };
        return typeof options.range === "function" ? options.range(from, to) : options.range;
      });
      query.single = vi.fn(async () => options.single ?? { data: null, error: null });
      query.maybeSingle = vi.fn(async () => options.single ?? { data: null, error: null });
      query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(
        table === "venue_price_options" ? { data: [], error: null } : { data: null, count: 0, error: null }
      ).then(resolve, reject);
      return query;
    }
  };
}
