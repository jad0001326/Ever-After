import { describe, expect, it } from "vitest";
import {
  canSetSupplierListingStatus,
  supplierCategoryBySlug,
} from "./supplier-directory";

describe("supplier directory activation gates", () => {
  it("maps future categories to their existing Budget Planner categories", () => {
    expect(supplierCategoryBySlug("videographer")?.budgetCategoryId).toBe("videography");
    expect(supplierCategoryBySlug("florist")?.budgetCategoryId).toBe("flowers");
    expect(supplierCategoryBySlug("celebrant")?.budgetCategoryId).toBe("registrar-celebrant");
  });

  it("allows a launched category to be published and keeps inactive categories in draft", () => {
    expect(canSetSupplierListingStatus("photographer", "published")).toBe(true);
    expect(canSetSupplierListingStatus("videographer", "published")).toBe(true);
    expect(canSetSupplierListingStatus("videographer", "draft")).toBe(true);
    expect(canSetSupplierListingStatus("florist", "draft")).toBe(true);
    expect(canSetSupplierListingStatus("florist", "archived")).toBe(true);
    expect(canSetSupplierListingStatus("florist", "published")).toBe(false);
    expect(canSetSupplierListingStatus("unknown", "draft")).toBe(false);
  });
});
