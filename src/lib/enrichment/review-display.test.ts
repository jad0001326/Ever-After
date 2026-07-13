import { describe, expect, it } from "vitest";
import { enrichmentBusinessName, firstValidBusinessEmail, selectPrimaryEmailCheck } from "./review-display";

describe("enrichment review display", () => {
  it("uses the staged audit businessName field", () => {
    expect(enrichmentBusinessName({ businessName: "The Mill Forge" })).toBe("The Mill Forge");
  });

  it("prefers the venue contact over unrelated scraped page fragments", () => {
    const preferred = { email: "weddings@venue.example", syntax_valid: true, domain_associated: true, status: "likely_valid" };
    const unrelated = { email: "//cdn.example/lodash@4.17.23", syntax_valid: false, domain_associated: false, status: "invalid" };
    expect(selectPrimaryEmailCheck([unrelated, preferred], ["weddings@venue.example"])).toBe(preferred);
  });

  it("falls back only to a syntactically valid official-domain address", () => {
    const associated = { email: "hello@venue.example", syntax_valid: true, domain_associated: true, status: "likely_valid" };
    const malformed = { email: "info@venue.examplecall", syntax_valid: false, domain_associated: false, status: "invalid" };
    expect(selectPrimaryEmailCheck([malformed, associated], [])).toBe(associated);
    expect(selectPrimaryEmailCheck([malformed], [])).toBeUndefined();
  });

  it("rejects URL fragments even when their suffix resembles an official email domain", () => {
    const bookingUrl = { email: "//outlook.office365.com/owa/calendar/book@venue.example", syntax_valid: true, domain_associated: true, status: "likely_valid" };
    expect(selectPrimaryEmailCheck([bookingUrl], [])).toBeUndefined();
    expect(firstValidBusinessEmail(bookingUrl.email, "hello@venue.example")).toBe("hello@venue.example");
  });
});
