import { describe, expect, it } from "vitest";
import {
  buildSupplierAdminNamePattern,
  buildSupplierAdminDirectoryHref,
  getSupplierAdminDirectoryPageCount,
  getSupplierAdminDirectoryRange,
  parseSupplierAdminDirectoryFilters,
} from "@/lib/supplier-admin-directory";

describe("supplier admin directory", () => {
  it("accepts known server-side filters and positive pages", () => {
    expect(parseSupplierAdminDirectoryFilters({
      category: "videographer",
      page: "3",
      query: "  Tay   Films  ",
      status: "draft",
    })).toEqual({ category: "videographer", page: 3, query: "Tay Films", status: "draft" });
  });

  it("drops unsupported filters and unsafe pages", () => {
    expect(parseSupplierAdminDirectoryFilters({
      category: "invented-category",
      page: "20-not-a-page",
      status: "pending",
    })).toEqual({ category: null, page: 1, query: "", status: null });
  });

  it("uses stable inclusive 25-row ranges", () => {
    expect(getSupplierAdminDirectoryRange(1)).toEqual({ from: 0, to: 24 });
    expect(getSupplierAdminDirectoryRange(3)).toEqual({ from: 50, to: 74 });
  });

  it("calculates at least one page and preserves filters in links", () => {
    expect(getSupplierAdminDirectoryPageCount(0)).toBe(1);
    expect(getSupplierAdminDirectoryPageCount(51)).toBe(3);
    expect(buildSupplierAdminDirectoryHref({ category: "videographer", page: 2, query: "Tay Films", status: "draft" }, 3))
      .toBe("/admin/suppliers?status=draft&category=videographer&query=Tay+Films&page=3");
  });

  it("escapes case-insensitive search wildcards", () => {
    expect(buildSupplierAdminNamePattern("100%_films\\north")).toBe("%100\\%\\_films\\\\north%");
  });
});
