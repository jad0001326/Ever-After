import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const result = {
    count: 51,
    data: [{
      base_town: "Dundee",
      category_slug: "videographer",
      id: "supplier-1",
      is_claimed: false,
      is_featured: false,
      listing_status: "draft",
      name: "Tay Films",
      region: "Tayside",
      slug: "tay-films",
      starting_price_pence: null,
      updated_at: "2026-08-17T09:00:00.000Z",
    }],
    error: null,
  };
  const query = {
    eq: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    select: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return {
    from: vi.fn(() => query),
    query,
    requireAdmin: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));

import AdminSuppliersPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("AdminSuppliersPage", () => {
  it("filters and paginates the catalogue on the server", async () => {
    render(await AdminSuppliersPage({
      searchParams: Promise.resolve({ category: "videographer", page: "2", query: "Tay Films", status: "draft" }),
    }));

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("supplier_listings");
    expect(mocks.query.select).toHaveBeenCalledWith(expect.stringContaining("category_slug"), { count: "exact" });
    expect(mocks.query.eq).toHaveBeenCalledWith("listing_status", "draft");
    expect(mocks.query.eq).toHaveBeenCalledWith("category_slug", "videographer");
    expect(mocks.query.ilike).toHaveBeenCalledWith("name", "%Tay Films%");
    expect(mocks.query.order).toHaveBeenNthCalledWith(1, "updated_at", { ascending: false });
    expect(mocks.query.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(mocks.query.range).toHaveBeenCalledWith(25, 49);
    expect(screen.getByText("51 profiles matching “Tay Films” in Videographers · draft")).toBeTruthy();
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("Tay Films");
    expect(screen.getByRole("option", { name: "Videographers" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Next" }).getAttribute("href"))
      .toBe("/admin/suppliers?status=draft&category=videographer&query=Tay+Films&page=3");
  });
});
