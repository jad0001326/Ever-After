import { describe, expect, it } from "vitest";
import { parseSupplierOwnerUpdate } from "@/lib/supplier-owner-update";

const valid = {
  baseTown: "Edinburgh",
  region: "Edinburgh and Lothians",
  serviceAreas: "Edinburgh, Fife\nThe Borders",
  travelsNationwide: "on",
  summary: "Natural wedding photography across Scotland.",
  description: "Relaxed, documentary wedding photography for couples across Scotland.",
  services: "Full-day photography\nAlbums",
  officialWebsiteUrl: "https://example.com",
  instagramUrl: "",
  facebookUrl: "",
  enquiryUrl: "https://example.com/contact",
  startingPrice: "1200",
  typicalPrice: "1800.50",
  pricingSummary: "Full-day packages available.",
  pricingUnit: "package",
  requestedMessage: "Updated our current coverage and pricing."
};

describe("parseSupplierOwnerUpdate", () => {
  it("normalises a bounded supplier proposal", () => {
    const result = parseSupplierOwnerUpdate(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.proposed_service_areas).toEqual(["Edinburgh", "Fife", "The Borders"]);
    expect(result.proposal.proposed_starting_price_pence).toBe(120000);
    expect(result.proposal.proposed_typical_price_pence).toBe(180050);
    expect(result.proposal.proposed_travels_nationwide).toBe(true);
  });

  it("rejects non-http links", () => {
    expect(parseSupplierOwnerUpdate({ ...valid, officialWebsiteUrl: "javascript:alert(1)" })).toEqual({ ok: false, message: "Links must be complete http or https URLs." });
  });

  it("rejects reversed price ranges", () => {
    expect(parseSupplierOwnerUpdate({ ...valid, startingPrice: "2000", typicalPrice: "1000" })).toEqual({ ok: false, message: "Typical price cannot be lower than the starting price." });
  });

  it("requires useful profile content and a review note", () => {
    expect(parseSupplierOwnerUpdate({ ...valid, services: "" }).ok).toBe(false);
    expect(parseSupplierOwnerUpdate({ ...valid, requestedMessage: "short" }).ok).toBe(false);
  });

  it("bounds individual service values", () => {
    expect(parseSupplierOwnerUpdate({ ...valid, services: "x".repeat(201) })).toEqual({ ok: false, message: "Keep each service description under 200 characters." });
    expect(parseSupplierOwnerUpdate({ ...valid, serviceAreas: "x".repeat(121) })).toEqual({ ok: false, message: "Keep each service area under 120 characters." });
  });
});
