import { describe, expect, it } from "vitest";
import { permittedSupplierHero } from "./supplier-media";

describe("permittedSupplierHero", () => {
  it("allows approved and clearly labelled representative imagery", () => {
    expect(permittedSupplierHero("https://example.com/approved.jpg", "approved")).toContain("approved.jpg");
    expect(permittedSupplierHero("https://example.com/representative.jpg", "representative")).toContain("representative.jpg");
  });

  it("does not expose pending or rejected imagery", () => {
    expect(permittedSupplierHero("https://example.com/pending.jpg", "pending")).toBeNull();
    expect(permittedSupplierHero("https://example.com/rejected.jpg", "rejected")).toBeNull();
    expect(permittedSupplierHero(null, "approved")).toBeNull();
  });
});
