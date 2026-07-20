import { describe, expect, it } from "vitest";
import { buildVenueFaqs, getVenueSeoCopy } from "@/lib/venue-seo";
import type { Venue } from "@/types/venue";

const venue: Venue = {
  id: "venue-1",
  slug: "bridge-gardens",
  name: "Bridge Gardens",
  type: "Country Estate",
  region: "Glasgow City",
  town: "Glasgow",
  country: "Scotland",
  summary: "A Glasgow celebration space.",
  description: "A Glasgow celebration space.",
  priceFrom: null,
  priceTo: null,
  priceOptions: [],
  capacityMin: 40,
  capacityMax: 180,
  heroImage: "/image.jpg",
  listingStatus: "published",
  claimStatus: "unclaimed",
  imagePermissionStatus: "representative",
  imageIsRepresentative: true,
  isClaimed: false,
  inviteStatus: "not_sent",
  images: [],
  amenities: [],
  isFeatured: false
};

describe("getVenueSeoCopy", () => {
  it("uses the GSC-informed override for a priority venue", () => {
    expect(getVenueSeoCopy(venue)).toMatchObject({
      title: "Bridge Gardens Glasgow Wedding Venue",
      keywords: expect.arrayContaining(["Bridge Gardens photos"])
    });
  });

  it("builds concise metadata for other venues", () => {
    const seo = getVenueSeoCopy({ ...venue, slug: "example-house", name: "Example House" });
    expect(seo.title).toBe("Example House Wedding Venue in Glasgow");
    expect(seo.description.length).toBeLessThanOrEqual(155);
  });
});

describe("buildVenueFaqs", () => {
  it("uses factual location, capacity, pricing and imagery answers", () => {
    const faqs = buildVenueFaqs(venue);
    expect(faqs).toHaveLength(4);
    expect(faqs[0].answer).toContain("Glasgow City");
    expect(faqs[1].answer).toContain("40 to 180 guests");
    expect(faqs[2].answer).toContain("does not currently hold a confirmed public price");
    expect(faqs[3].answer).toContain("venue-approved photography");
  });
});
