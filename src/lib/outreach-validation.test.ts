import { describe, expect, it } from "vitest";
import {
  hasOfficialContactSource,
  isTrustedVenueContact,
  isValidOutreachEmail,
  normalizeEmail,
  validPublicUrl
} from "./outreach-validation";

describe("outreach validation", () => {
  it("normalizes email exactly as the outreach service does", () => {
    expect(normalizeEmail("  Weddings@Venue.Co.UK  ")).toBe("weddings@venue.co.uk");
  });

  it("accepts ordinary syntax and rejects malformed or placeholder addresses", () => {
    expect(isValidOutreachEmail("weddings@venue.co.uk")).toBe(true);
    expect(isValidOutreachEmail("not-an-email")).toBe(false);
    expect(isValidOutreachEmail("//outlook.office365.com/owa/calendar/book@venue.co.uk")).toBe(false);
    expect(isValidOutreachEmail("%20info@venue.co.uk")).toBe(false);
    expect(isValidOutreachEmail("test@venue.co.uk")).toBe(false);
    expect(isValidOutreachEmail("hello@example.com")).toBe(false);
  });

  it("accepts only public HTTP URLs and removes fragments", () => {
    expect(validPublicUrl("https://venue.co.uk/contact#form")).toBe("https://venue.co.uk/contact");
    expect(validPublicUrl("https://user:secret@venue.co.uk/contact")).toBeNull();
    expect(validPublicUrl("http://localhost/contact")).toBeNull();
    expect(validPublicUrl("mailto:hello@venue.co.uk")).toBeNull();
  });

  it("matches same-host and parent/subdomain contact sources", () => {
    expect(hasOfficialContactSource("https://www.venue.co.uk/contact", "https://venue.co.uk")).toBe(true);
    expect(hasOfficialContactSource("https://weddings.venue.co.uk/enquire", "https://venue.co.uk")).toBe(true);
    expect(hasOfficialContactSource("https://directory.example/venue", "https://venue.co.uk")).toBe(false);
  });

  it("requires both a valid email and an official-host source", () => {
    const venue = { official_website_url: "https://venue.co.uk" };
    expect(isTrustedVenueContact("weddings@venue.co.uk", "https://venue.co.uk/contact", venue)).toBe(true);
    expect(isTrustedVenueContact("weddings@venue.co.uk", null, venue)).toBe(false);
    expect(isTrustedVenueContact("test@venue.co.uk", "https://venue.co.uk/contact", venue)).toBe(false);
  });
});
