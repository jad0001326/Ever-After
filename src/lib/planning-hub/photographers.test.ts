import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchSuppliers: vi.fn(),
  getSupplierDetail: vi.fn(),
  contains: vi.fn(),
  inIds: vi.fn(),
  maybeSingle: vi.fn(),
}));

const profileQuery = {
  select: vi.fn(() => profileQuery),
  contains: mocks.contains,
  in: mocks.inIds,
  eq: vi.fn(() => profileQuery),
  maybeSingle: mocks.maybeSingle,
};

const client = {
  from: vi.fn(() => profileQuery),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => client),
}));

vi.mock("./suppliers", () => ({
  searchPlanningHubSuppliers: mocks.searchSuppliers,
  getPlanningHubSupplierDetail: mocks.getSupplierDetail,
}));

import {
  getPlanningHubPhotographerDetail,
  searchPlanningHubPhotographers,
} from "./photographers";

const supplier = {
  id: "10000000-0000-4000-8000-000000000001",
  categorySlug: "photographer" as const,
  slug: "photographer-one",
  name: "Photographer One",
  baseTown: "Perth",
  region: "Perthshire",
  summary: "Natural wedding photography.",
  heroImageUrl: "/photo.jpg",
  hasApprovedPhoto: true,
  visualStatus: "representative" as const,
  startingPricePence: 150_000,
  typicalPricePence: 190_000,
  pricingSummary: "Full-day coverage",
  pricingUnit: "package",
  isClaimed: true,
  travelsNationwide: true,
};

const profile = {
  supplier_id: supplier.id,
  styles: ["Documentary"],
  coverage_hours_min: 8,
  coverage_hours_max: 10,
  turnaround_weeks_min: 6,
  turnaround_weeks_max: 8,
};

describe("Planning Hub photographer specialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.contains.mockResolvedValue({ data: [{ supplier_id: supplier.id }], error: null });
    mocks.inIds.mockResolvedValue({ data: [profile], error: null });
    mocks.maybeSingle.mockResolvedValue({ data: profile, error: null });
    mocks.searchSuppliers.mockResolvedValue({
      suppliers: [supplier],
      total: 1,
      page: 1,
      totalPages: 1,
      venueContext: "stale",
    });
    mocks.getSupplierDetail.mockResolvedValue({
      ...supplier,
      description: "A detailed profile.",
      services: ["Full-day coverage"],
      officialWebsiteUrl: "https://example.test",
      enquiryUrl: null,
      imageCredit: "Supplier",
      gallery: [{ id: "image-1", url: "/photo.jpg", alt: "A wedding" }],
    });
  });

  it("adds style matching and profile data to shared supplier results", async () => {
    const result = await searchPlanningHubPhotographers({
      style: "Documentary",
      location: "Perthshire",
    });

    expect(mocks.searchSuppliers).toHaveBeenCalledWith(
      "photographer",
      { style: "Documentary", location: "Perthshire" },
      expect.objectContaining({
        candidateIds: [supplier.id],
        client,
      }),
    );
    expect(result.photographers[0]).toMatchObject({
      id: supplier.id,
      name: "Photographer One",
      styles: ["Documentary"],
      startingPricePence: 150_000,
      visualStatus: "representative",
    });
    expect(result.venueContext).toBe("stale");
  });

  it("combines shared supplier detail with photography-only fields", async () => {
    const result = await getPlanningHubPhotographerDetail(supplier.id);

    expect(mocks.getSupplierDetail).toHaveBeenCalledWith("photographer", supplier.id, client);
    expect(result).toMatchObject({
      id: supplier.id,
      description: "A detailed profile.",
      coverageHoursMin: 8,
      coverageHoursMax: 10,
      turnaroundWeeksMin: 6,
      turnaroundWeeksMax: 8,
    });
  });

  it("does not expose database error text from style matching", async () => {
    mocks.contains.mockResolvedValueOnce({
      data: null,
      error: { message: "relation photographer_profiles_internal does not exist" },
    });

    const result = await searchPlanningHubPhotographers({ style: "Editorial" });

    expect(result.error).toBe("Photography styles could not be filtered.");
    expect(result.error).not.toContain("photographer_profiles_internal");
    expect(mocks.searchSuppliers).not.toHaveBeenCalled();
  });

  it("does not silently drop profile data when profile hydration fails", async () => {
    mocks.inIds.mockResolvedValueOnce({
      data: null,
      error: { message: "relation photographer_profiles_internal does not exist" },
    });

    const result = await searchPlanningHubPhotographers({ location: "Perthshire" });

    expect(result.error).toBe("Photography profiles could not be loaded.");
    expect(result.photographers).toEqual([]);
    expect(result.error).not.toContain("photographer_profiles_internal");
  });

  it("treats a detail profile failure as catalogue unavailability", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied for photographer_profiles" },
    });

    await expect(getPlanningHubPhotographerDetail(supplier.id))
      .rejects.toThrow("Photography catalogue is unavailable.");
  });
});
