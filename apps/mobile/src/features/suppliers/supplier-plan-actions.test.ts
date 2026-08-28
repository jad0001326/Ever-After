import { createDevicePlan } from "../../planning/device-plan-model";
import { addManualPhotographer, addPhotographerToPlan, SupplierCompareLimitError, toggleComparedSupplier } from "./supplier-plan-actions";

describe("native photography plan actions", () => {
  it("restores a unique comparison and enforces the three-item limit", () => {
    let plan = createPlan();
    plan = toggleComparedSupplier(plan, supplier(1));
    plan = toggleComparedSupplier(plan, supplier(1));
    expect(plan.discovery.comparedSuppliers).toEqual([]);
    plan = toggleComparedSupplier(toggleComparedSupplier(toggleComparedSupplier(plan, supplier(1)), supplier(2)), supplier(3));
    expect(() => toggleComparedSupplier(plan, supplier(4))).toThrow(SupplierCompareLimitError);
  });

  it("upserts one photography item with unchecked availability", () => {
    const first = addPhotographerToPlan(createPlan(), supplier(1), 150_000, "shortlisted");
    const updated = addPhotographerToPlan(first, supplier(1), 175_000, "quoted");
    const items = updated.budgetPlan.items.filter((item) => item.categoryId === "photography");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ listingId: supplier(1).id, confirmedCostPence: 175_000, bookingStatus: "quoted", availabilityStatus: "not_checked" });
  });

  it("keeps a manual fallback", () => {
    const plan = addManualPhotographer(createPlan(), "Local Photographer", 120_000);
    expect(plan.budgetPlan.items.at(-1)).toMatchObject({ categoryId: "photography", source: "manual", itemName: "Local Photographer" });
  });
});

function createPlan() { return createDevicePlan({ weddingDate: "2027-08-14", location: "Fife", guestCount: 80, totalBudgetPence: 2_000_000, priorities: ["venue"], weddingSeason: null }); }
function supplier(index: number) { return { id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`, categorySlug: "photographer" as const, slug: `photo-${index}`, name: `Photo ${index}`, baseTown: "Cupar", region: "Fife", summary: "A photographer.", styles: ["Documentary"], imageUrl: null, visualStatus: "absent" as const, startingPricePence: 150_000, typicalPricePence: null, pricingSummary: null, pricingUnit: "event", isClaimed: false, travelsNationwide: false, availabilityStatus: "not_checked" as const }; }
