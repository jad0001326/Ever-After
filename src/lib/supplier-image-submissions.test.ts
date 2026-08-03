import { describe, expect, it } from "vitest";
import { validateSupplierRegistrationInput } from "@/lib/supplier-image-submissions";

const userId = "10000000-0000-4000-8000-000000000001";
const supplierId = "50000000-0000-4000-8000-000000000005";
const validItem = {
  storagePath: `${userId}/${supplierId}/70000000-0000-4000-8000-000000000007.jpg`,
  originalFileName: "studio portrait.jpg",
  mimeType: "image/jpeg" as const,
  fileSize: 120_000,
  altText: "Wedding filmmaker recording a ceremony",
  creditText: "Supplier team",
  isPreferred: true
};

describe("supplier image submission validation", () => {
  it("accepts a rights-confirmed private upload for the managed supplier", () => {
    expect(validateSupplierRegistrationInput({ supplierId, permissionConfirmed: true, items: [validItem] }, userId)).toBeNull();
  });

  it("rejects a path outside the signed-in member and supplier boundary", () => {
    expect(validateSupplierRegistrationInput({
      supplierId,
      permissionConfirmed: true,
      items: [{ ...validItem, storagePath: `20000000-0000-4000-8000-000000000002/${supplierId}/70000000-0000-4000-8000-000000000007.jpg` }]
    }, userId)).toContain("file paths is invalid");
  });

  it("requires explicit display permission", () => {
    expect(validateSupplierRegistrationInput({ supplierId, permissionConfirmed: false, items: [validItem] }, userId)).toContain("permission");
  });
});
