import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

import {
  getPlanningHubVenueDetail,
  getPlanningHubVenueImageStatus,
  searchPlanningHubVenues,
} from "./venues";

describe("Planning Hub venue query boundary", () => {
  beforeEach(() => createClient.mockReset());

  it("orders every page by a deterministic id tie-breaker", async () => {
    const query = queryBuilder({ data: [], count: 0, error: null });
    createClient.mockResolvedValue({ from: () => query });

    await searchPlanningHubVenues({ page: "2" });

    expect(query.order.mock.calls).toEqual([
      ["is_featured", { ascending: false }],
      ["name", { ascending: true }],
      ["id", { ascending: true }],
    ]);
    expect(query.range).toHaveBeenCalledWith(8, 15);
    expect(query.not).toHaveBeenCalledWith(
      "slug",
      "like",
      "everaft-internal-test-%",
    );
  });

  it("denies direct internal-test detail ids at the database query", async () => {
    const query = queryBuilder({ data: null, error: null });
    createClient.mockResolvedValue({ from: () => query });

    await expect(getPlanningHubVenueDetail(
      "10000000-0000-4000-8000-000000000001",
    )).resolves.toBeNull();
    expect(query.not).toHaveBeenCalledWith(
      "slug",
      "like",
      "everaft-internal-test-%",
    );
  });

  it("distinguishes approved, representative and absent imagery", () => {
    expect(getPlanningHubVenueImageStatus({
      hero_image: "https://images.example/approved.jpg",
      image_permission_status: "approved",
      image_is_representative: false,
    })).toBe("approved");
    expect(getPlanningHubVenueImageStatus({
      hero_image: "https://images.example/representative.jpg",
      image_permission_status: "representative",
      image_is_representative: true,
    })).toBe("representative");
    expect(getPlanningHubVenueImageStatus({
      hero_image: "",
      image_permission_status: "approved",
      image_is_representative: false,
    })).toBe("absent");
  });
});

function queryBuilder(result: unknown) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "in", "not", "or", "gte", "lte", "order"]) {
    query[method] = vi.fn(() => query);
  }
  query.range = vi.fn(async () => result);
  query.maybeSingle = vi.fn(async () => result);
  return query;
}
