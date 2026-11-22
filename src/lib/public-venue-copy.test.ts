import { describe, expect, it } from "vitest";
import { publicVenueCopy } from "@/lib/public-venue-copy";

const NOTE = "Imported for EverAft launch review from public venue research; confirm copy, pricing, imagery, and permissions before publishing.";

describe("public venue copy", () => {
  it("removes the launch-review note and keeps the public sentence", () => {
    const summary = "Beach Ballroom is a country estate in Aberdeen for weddings and private celebrations.";
    expect(publicVenueCopy(`${summary} ${NOTE}`)).toBe(summary);
  });

  it("removes a repeated note and leaves nothing when that is the whole description", () => {
    expect(publicVenueCopy(`${NOTE} ${NOTE}`)).toBe("");
    expect(publicVenueCopy("")).toBe("");
    expect(publicVenueCopy(null)).toBe("");
  });

  it("leaves reviewed copy unchanged", () => {
    const copy = "Glencorse House has ceremony spaces and landscaped grounds.";
    expect(publicVenueCopy(copy)).toBe(copy);
  });
});
