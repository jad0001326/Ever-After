import { createDevicePlan } from "../../planning/device-plan-model";
import {
  addManualVenue,
  selectVenue,
  setVenueSavedOnDevice,
  shortlistVenue,
  toggleComparedVenue,
  VenueCompareLimitError,
  venuePlanningCost,
} from "./venue-plan-actions";

describe("device venue decision actions", () => {
  it("persists a unique three-venue comparison across encoded plan state", () => {
    let plan = devicePlan();
    for (let index = 1; index <= 3; index += 1) {
      plan = toggleComparedVenue(plan, venue(index));
    }
    expect(plan.discovery.comparedVenues.map((item) => item.id)).toHaveLength(3);
    expect(() => toggleComparedVenue(plan, venue(4))).toThrow(VenueCompareLimitError);
    expect(toggleComparedVenue(plan, venue(2)).discovery.comparedVenues)
      .toHaveLength(2);
  });

  it("keeps bookmarks unique and separate from budget decisions", () => {
    const saved = setVenueSavedOnDevice(
      setVenueSavedOnDevice(devicePlan(), venue(1).id, true),
      venue(1).id,
      true,
    );
    expect(saved.discovery.savedVenueIds).toEqual([venue(1).id]);
    expect(saved.budgetPlan.items).toEqual([]);
  });

  it("shortlists once, selects explicitly and updates planning cost", () => {
    const candidate = venue(1);
    const shortlisted = shortlistVenue(devicePlan(), candidate, 600_000);
    expect(shortlisted.budgetPlan.items[0].imageUrl).toBeNull();
    const duplicate = shortlistVenue(shortlisted, candidate, 650_000, "quoted");
    expect(duplicate.budgetPlan.items).toHaveLength(1);
    expect(duplicate.budgetPlan.items[0].confirmedCostPence).toBe(650_000);

    const selected = selectVenue(duplicate, candidate, 650_000, "booked");
    expect(selected.budgetPlan.selectedVenueId).toBe(candidate.id);
    expect(selected.budgetPlan.items[0].bookingStatus).toBe("booked");
  });

  it("supports manual fallback and per-person planning costs", () => {
    const manual = addManualVenue(devicePlan(), " Village Hall ", 250_000);
    expect(manual.budgetPlan.items[0]).toMatchObject({
      itemName: "Village Hall",
      source: "manual",
      bookingStatus: "shortlisted",
    });
    expect(venuePlanningCost({ ...venue(1), priceFromPence: 5_000, pricingUnit: "per_person" }, 80))
      .toBe(400_000);
  });
});

function devicePlan() {
  return createDevicePlan({
    weddingDate: null,
    location: "Fife",
    guestCount: 80,
    totalBudgetPence: 2_000_000,
    priorities: ["venue"],
    weddingSeason: "Summer 2027",
  }, new Date("2026-08-25T10:00:00.000Z"));
}

function venue(index: number) {
  return {
    id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    slug: `venue-${index}`,
    name: `Venue ${index}`,
    type: "Castle",
    town: "Cupar",
    region: "Fife",
    summary: "A venue.",
    capacityMax: 120,
    imageUrl: null,
    imageStatus: "absent" as const,
    priceFromPence: 600_000,
    pricingLabel: "From",
    pricingUnit: "total",
  };
}
