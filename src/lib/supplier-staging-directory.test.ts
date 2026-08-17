import { describe, expect, it } from "vitest";
import {
  buildSupplierStagingDirectoryHref,
  getSupplierStagingDirectoryPageCount,
  getSupplierStagingDirectoryRange,
  parseSupplierStagingDirectoryFilters,
} from "@/lib/supplier-staging-directory";

describe("supplier staging directory", () => {
  it("accepts known queue filters", () => {
    expect(parseSupplierStagingDirectoryFilters({
      category: "videographer",
      page: "2",
      status: "duplicate",
    })).toEqual({ category: "videographer", page: 2, status: "duplicate" });
  });

  it("falls back to the staged queue for invalid input", () => {
    expect(parseSupplierStagingDirectoryFilters({
      category: "unknown",
      page: "2-extra",
      status: "pending",
    })).toEqual({ category: null, page: 1, status: "staged" });
  });

  it("uses stable inclusive 25-row ranges", () => {
    expect(getSupplierStagingDirectoryRange(1)).toEqual({ from: 0, to: 24 });
    expect(getSupplierStagingDirectoryRange(2)).toEqual({ from: 25, to: 49 });
  });

  it("preserves the category while resetting pages for a status change", () => {
    const filters = { category: "videographer", page: 3, status: "staged" as const };
    expect(getSupplierStagingDirectoryPageCount(26)).toBe(2);
    expect(buildSupplierStagingDirectoryHref(filters, { page: 1, status: "accepted" }))
      .toBe("/admin/supplier-staging?status=accepted&category=videographer");
  });
});
