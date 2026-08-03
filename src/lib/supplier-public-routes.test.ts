import { describe, expect, it } from "vitest";
import {
  getPublicSupplierCategory,
  publicSupplierCategoryPath,
  publicSupplierClaimPath,
  publicSupplierProfilePath,
} from "./supplier-public-routes";

describe("public supplier routes", () => {
  it("preserves established photographer URLs", () => {
    expect(publicSupplierCategoryPath("photographer")).toBe("/photographers");
    expect(publicSupplierProfilePath("photographer", "north-light")).toBe("/photographers/north-light");
    expect(publicSupplierClaimPath("photographer", "north-light")).toBe("/photographers/north-light/claim");
  });

  it("builds category-neutral URLs for future catalogues", () => {
    expect(publicSupplierCategoryPath("florist")).toBe("/suppliers/florist");
    expect(publicSupplierProfilePath("florist", "wild-blooms")).toBe("/suppliers/florist/wild-blooms");
    expect(publicSupplierClaimPath("florist", "wild-blooms")).toBe("/suppliers/florist/wild-blooms/claim");
  });

  it("keeps inactive and unknown categories inaccessible", () => {
    expect(getPublicSupplierCategory("photographer")?.label).toBe("Photographer");
    expect(getPublicSupplierCategory("florist")).toBeNull();
    expect(getPublicSupplierCategory("unknown")).toBeNull();
  });
});
