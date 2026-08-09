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

  it("allows private drafts but blocks publishing an inactive category", () => {
    expect(canSetSupplierListingStatus("photographer", "published")).toBe(true);
    expect(canSetSupplierListingStatus("videographer", "draft")).toBe(true);
    expect(canSetSupplierListingStatus("videographer", "archived")).toBe(true);
    expect(canSetSupplierListingStatus("videographer", "published")).toBe(false);
    expect(canSetSupplierListingStatus("unknown", "draft")).toBe(false);
  });
});
