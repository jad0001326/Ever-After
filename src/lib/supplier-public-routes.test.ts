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

  it("opens launched categories and keeps inactive ones inaccessible", () => {
    expect(getPublicSupplierCategory("photographer")?.label).toBe("Photographer");
    expect(getPublicSupplierCategory("videographer")?.plural).toBe("Videographers");
    expect(publicSupplierCategoryPath("videographer")).toBe("/suppliers/videographer");
    expect(getPublicSupplierCategory("florist")).toBeNull();
    expect(getPublicSupplierCategory("unknown")).toBeNull();
  });
});
