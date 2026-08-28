import { describe, expect, it, vi } from "vitest";
import { getPlanningHubSupplierDetail, searchPlanningHubSuppliers } from "./suppliers";

describe("Planning Hub supplier catalogue boundaries", () => {
  it("returns typed stale venue context instead of broadening the search", async () => {
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    const client = { from: vi.fn(() => query) };
    const result = await searchPlanningHubSuppliers("photographer", {
      venue: "10000000-0000-4000-8000-000000000001",
    }, { client: client as never });

    expect(result).toMatchObject({ suppliers: [], total: 0, venueContext: "stale" });
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith("venues");
  });

  it("denies dormant-category detail before touching the database", async () => {
    const client = { from: vi.fn() };
    const result = await getPlanningHubSupplierDetail(
      "videographer",
      "10000000-0000-4000-8000-000000000001",
      client as never,
    );
    expect(result).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("distinguishes a detail-query failure from a missing supplier", async () => {
    const supplierQuery = {
      select: vi.fn(() => supplierQuery), eq: vi.fn(() => supplierQuery),
      maybeSingle: vi.fn(async () => ({ data: null, error: { message: "relation private_table does not exist" } })),
    };
    const imageQuery = {
      select: vi.fn(() => imageQuery), eq: vi.fn(() => imageQuery), order: vi.fn(() => imageQuery),
      limit: vi.fn(async () => ({ data: [], error: null })),
    };
    const client = {
      from: vi.fn((table: string) => table === "supplier_listings" ? supplierQuery : imageQuery),
    };

    await expect(getPlanningHubSupplierDetail(
      "photographer",
      "10000000-0000-4000-8000-000000000001",
      client as never,
    )).rejects.toThrow("Supplier catalogue is unavailable.");
  });
});
