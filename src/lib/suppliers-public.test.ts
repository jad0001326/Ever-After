import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => createClient(...args)
}));

import { getPhotographerVenueOptions } from "@/lib/suppliers";

describe("public photographer venue options", () => {
  beforeEach(() => createClient.mockReset());

  it("drops the internal QA listing from the venue filter", async () => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    const chain = () => query;
    for (const method of ["select", "eq", "in", "not", "neq", "order", "limit"]) query[method] = vi.fn(chain);
    query.then = vi.fn((resolve: (value: unknown) => unknown) => Promise.resolve({
      data: [
        { id: "venue-real", slug: "beach-ballroom", name: "Beach Ballroom", town: "Aberdeen", region: "Aberdeen City" },
        { id: "venue-test", slug: "everaft-internal-test-claim", name: "EverAft Internal Test Venue", town: "Test Listing", region: "Internal QA" }
      ],
      error: null
    }).then(resolve)) as unknown as ReturnType<typeof vi.fn>;
    createClient.mockResolvedValue({ from: () => query });

    await expect(getPhotographerVenueOptions()).resolves.toEqual([
      { id: "venue-real", name: "Beach Ballroom", town: "Aberdeen", region: "Aberdeen City" }
    ]);
    expect(query.not).toHaveBeenCalledWith("slug", "like", "everaft-internal-test-%");
    expect(query.neq).toHaveBeenCalledWith("region", "Internal QA");
  });
});
