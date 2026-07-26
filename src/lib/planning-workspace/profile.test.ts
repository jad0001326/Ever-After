import { describe, expect, it } from "vitest";
import { createEmptyBudgetPlan } from "@/lib/budget/persistence";
import {
  createWeddingProfile,
  profileCompletion,
  profileVenueSearchHref,
  restoreWeddingProfile,
} from "./profile";
import type { WeddingProfile } from "./profile";

describe("wedding profile", () => {
  it("reuses the existing budget basics as the profile source", () => {
    const budget = {
      ...createEmptyBudgetPlan(),
      weddingDate: "2027-06-12",
      guestCount: 90,
      location: "Perthshire",
      totalBudgetPence: 2_500_000,
    };
    const profile = createWeddingProfile(budget);

    expect(profile).toMatchObject({
      weddingDate: "2027-06-12",
      guestCount: 90,
      location: "Perthshire",
      dateFlexibility: "fixed",
    });
    expect(profileVenueSearchHref(profile, budget.totalBudgetPence))
      .toBe("/planning-hub?location=Perthshire&guests=90&budget=25000");
  });

  it("restores only complete, versioned private profile records", () => {
    const fallback = createWeddingProfile();
    const profile: WeddingProfile = {
      ...fallback,
      priorities: ["venue", "guest_experience"],
      venueStyles: ["Castle"],
    };

    expect(restoreWeddingProfile(profile, fallback)).toEqual(profile);
    expect(restoreWeddingProfile({ schemaVersion: 1, priorities: ["unknown"] }, fallback)).toBe(fallback);
  });

  it("reports profile readiness without requiring every optional preference", () => {
    const profile: WeddingProfile = {
      ...createWeddingProfile(),
      guestCount: 80,
      location: "Fife",
      priorities: ["venue"],
    };

    expect(profileCompletion(profile)).toEqual({ completed: 3, total: 5, percentage: 60 });
  });

  it("uses a compatible venue preference as a live catalogue filter", () => {
    const profile: WeddingProfile = {
      ...createWeddingProfile(),
      venueStyles: ["Country house", "Outdoor"],
    };

    expect(profileVenueSearchHref(profile, 0))
      .toBe("/planning-hub?type=Country+Estate");
  });
});
