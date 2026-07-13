import { describe, expect, it } from "vitest";
import { representativeImageForType, shouldUseVenuePassport } from "./venue-images";

describe("venue image presentation", () => {
  it("uses a Passport for representative, unapproved, or known stock fallback imagery", () => {
    const representative = representativeImageForType("Castle");

    expect(shouldUseVenuePassport({ imageIsRepresentative: true, imagePermissionStatus: "representative", heroImage: representative })).toBe(true);
    expect(shouldUseVenuePassport({ imageIsRepresentative: false, imagePermissionStatus: "pending", heroImage: "https://example.com/venue.jpg" })).toBe(true);
    expect(shouldUseVenuePassport({ imageIsRepresentative: false, imagePermissionStatus: "approved", heroImage: representative })).toBe(true);
  });

  it("keeps a separately approved venue photograph as the first choice", () => {
    expect(shouldUseVenuePassport({ imageIsRepresentative: false, imagePermissionStatus: "approved", heroImage: "https://cdn.example.com/venue.jpg" })).toBe(false);
  });
});
