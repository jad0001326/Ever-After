import { describe, expect, it } from "vitest";
import { isSafeBatchEnrichmentProposal, parseAdminProposedValue } from "./review-policy";

describe("enrichment review policy", () => {
  it("allows only pending high-confidence non-sensitive proposals in a batch", () => {
    expect(isSafeBatchEnrichmentProposal({ confidence: "high", status: "pending", targetField: "phone" })).toBe(true);
    expect(isSafeBatchEnrichmentProposal({ confidence: "medium", status: "pending", targetField: "phone" })).toBe(false);
    expect(isSafeBatchEnrichmentProposal({ confidence: "high", status: "approved", targetField: "phone" })).toBe(false);
    expect(isSafeBatchEnrichmentProposal({ confidence: "high", status: "pending", targetField: "phone", requiresManualReview: true })).toBe(false);
  });

  it("keeps identity, contact, business-status and outreach-state changes out of batch approval", () => {
    for (const targetField of ["name", "vendor_contact_email", "vendor_contact_source_url", "business_status", "structured_pricing", "price_from", "price_to", "listing_status", "claim_status", "invite_status"]) {
      expect(isSafeBatchEnrichmentProposal({ confidence: "high", status: "pending", targetField })).toBe(false);
    }
  });

  it("parses structured edits without inventing types for ordinary text", () => {
    expect(parseAdminProposedValue('{"pricingStatus":"contact_for_price"}')).toEqual({ pricingStatus: "contact_for_price" });
    expect(parseAdminProposedValue("hello@venue.example")).toBe("hello@venue.example");
    expect(parseAdminProposedValue("")).toBeNull();
  });
});
