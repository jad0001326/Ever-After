import { describe, expect, it } from "vitest";
import { supplierAdminSchemaEnabled } from "./supplier-admin-flags";

describe("supplier admin schema flag", () => {
  it("stays closed unless the server flag is exactly true", () => {
    expect(supplierAdminSchemaEnabled({})).toBe(false);
    expect(supplierAdminSchemaEnabled({ SUPPLIER_ADMIN_SCHEMA_ENABLED: "false" })).toBe(false);
    expect(supplierAdminSchemaEnabled({ SUPPLIER_ADMIN_SCHEMA_ENABLED: "TRUE" })).toBe(false);
    expect(supplierAdminSchemaEnabled({ SUPPLIER_ADMIN_SCHEMA_ENABLED: "1" })).toBe(false);
    expect(supplierAdminSchemaEnabled({ SUPPLIER_ADMIN_SCHEMA_ENABLED: "true" })).toBe(true);
  });
});
