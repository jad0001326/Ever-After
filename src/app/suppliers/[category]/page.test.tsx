import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanningHubSupplier } from "@/lib/planning-hub/types";

const search = vi.fn();
vi.mock("@/lib/planning-hub/suppliers", () => ({
  searchPlanningHubSuppliers: (...args: unknown[]) => search(...args),
}));

import SupplierCategoryPage from "./page";

const channelOne: PlanningHubSupplier = {
  id: "videographer-1",
  categorySlug: "videographer",
  slug: "channel-one-wedding-films",
  name: "Channel One Wedding Films",
  baseTown: "Lancaster",
  region: "Lancashire",
  summary: "Lancashire wedding films with coverage into Scotland.",
  heroImageUrl: "/everaft-logo-mark.svg",
  hasApprovedPhoto: false,
  visualStatus: "representative",
  startingPricePence: null,
  typicalPricePence: null,
  pricingSummary: "Films quoted for the celebration.",
  pricingUnit: "quote",
  isClaimed: false,
  travelsNationwide: false,
};

describe("public videographer category page", () => {
  beforeEach(() => search.mockReset());

  it("renders a single listing without implying a full catalogue or a Scottish base", async () => {
    search.mockResolvedValue({ suppliers: [channelOne], total: 1, page: 1, totalPages: 1 });

    render(await SupplierCategoryPage({
      params: Promise.resolve({ category: "videographer" }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("heading", { name: "Wedding videographers for Scottish celebrations" })).toBeTruthy();
    expect(screen.getByText("1 videographer")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Channel One Wedding Films" }).getAttribute("href")).toBe("/suppliers/videographer/channel-one-wedding-films");
    expect(screen.getByText("Lancaster, Lancashire")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Videographers pages" })).toBeNull();
    expect(screen.queryByText(/Scottish wedding videographers/)).toBeNull();
  });

  it("offers a clear empty search instead of a closed planning workspace", async () => {
    search.mockResolvedValue({ suppliers: [], total: 0, page: 1, totalPages: 1 });

    render(await SupplierCategoryPage({
      params: Promise.resolve({ category: "videographer" }),
      searchParams: Promise.resolve({ location: "Shetland" }),
    }));

    expect(screen.getByRole("heading", { name: "No videographers match that search" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Clear search" }).getAttribute("href")).toBe("/suppliers/videographer");
    expect(screen.queryByText(/Planning Hub/)).toBeNull();
  });
});
