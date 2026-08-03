import { describe, expect, it } from "vitest";
import {
  assertSupplierCategoryOutreachEnabled,
  supplierCategoryOutreachEnabled,
} from "./outreach-flags";

describe("supplier category outreach flag", () => {
  it("stays closed unless the server flag is exactly true", () => {
    expect(supplierCategoryOutreachEnabled({})).toBe(false);
    expect(supplierCategoryOutreachEnabled({ SUPPLIER_CATEGORY_OUTREACH_ENABLED: "false" })).toBe(false);
    expect(supplierCategoryOutreachEnabled({ SUPPLIER_CATEGORY_OUTREACH_ENABLED: "TRUE" })).toBe(false);
    expect(supplierCategoryOutreachEnabled({ SUPPLIER_CATEGORY_OUTREACH_ENABLED: "true" })).toBe(true);
  });

  it("blocks generic supplier mutations while preserving legacy audiences", () => {
    expect(() => assertSupplierCategoryOutreachEnabled("venue", {})).not.toThrow();
    expect(() => assertSupplierCategoryOutreachEnabled("photographer", {})).not.toThrow();
    expect(() => assertSupplierCategoryOutreachEnabled("supplier", {})).toThrow(
      "Supplier category outreach is not enabled.",
    );
    expect(() => assertSupplierCategoryOutreachEnabled("supplier", {
      SUPPLIER_CATEGORY_OUTREACH_ENABLED: "true",
    })).not.toThrow();
  });
});
