import { describe, expect, it } from "vitest";
import { plannerListingToBudgetItem } from "./listing-pricing";
import { createEmptyBudgetPlan } from "./persistence";
import { budgetPlanSchema } from "./validation";

function planWithItem() {
  const plan = createEmptyBudgetPlan();
  plan.items = [plannerListingToBudgetItem({
    id: "venue-1",
    slug: "venue-one",
    name: "Venue One",
    type: "Venue",
    categoryId: "venue",
    location: "Perthshire",
    imageUrl: "/venue.jpg",
    listingUrl: "/venues/venue-one",
    priceFromPence: 500_000,
    priceToPence: null,
    pricingStatus: "fixed",
  }, plan)];
  return plan;
}

describe("budget plan validation", () => {
  it("adds safe availability defaults to a legacy cloud plan", () => {
    const plan = planWithItem();
    const legacy = {
      ...plan,
      items: plan.items.map(({ availabilityDate: _date, availabilityStatus: _status, ...item }) => item),
    };
    const parsed = budgetPlanSchema.parse(legacy);

    expect(parsed.items[0]).toMatchObject({
      availabilityStatus: "not_checked",
      availabilityDate: null,
    });
  });

  it("rejects a claimed availability result without the date checked", () => {
    const plan = planWithItem();
    plan.items[0].availabilityStatus = "available";
    plan.items[0].availabilityDate = null;

    expect(budgetPlanSchema.safeParse(plan).success).toBe(false);
  });
});
