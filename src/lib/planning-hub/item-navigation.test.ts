import { describe, expect, it } from "vitest";
import type { BudgetItem } from "@/lib/budget/types";
import {
  getPlanningHubItemStageHref,
  getPlanningHubItemStageRoute,
} from "./item-navigation";

function item(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: "item-1",
    categoryId: "venue",
    listingId: null,
    listingType: null,
    listingUrl: null,
    imageUrl: null,
    source: "manual",
    itemName: "Venue One",
    supplierName: null,
    supplierType: "Venue",
    description: null,
    estimatedCostPence: 100_000,
    confirmedCostPence: null,
    importedPricePence: null,
    importedPriceToPence: null,
    importedPriceType: null,
    costPerPersonPence: null,
    guestCount: null,
    depositPaidPence: 0,
    totalPaidPence: 0,
    installments: [],
    costStatus: "estimated",
    paymentStatus: "not_started",
    bookingStatus: "shortlisted",
    dueDate: null,
    websiteUrl: null,
    notes: null,
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:00:00.000Z",
    sortOrder: 0,
    ...overrides,
  };
}

describe("Planning Hub item navigation", () => {
  it("returns stage editors while preserving a shared workspace", () => {
    expect(getPlanningHubItemStageHref(
      item(),
      "60000000-0000-4000-8000-000000000006",
    )).toBe("/planning-hub?planItem=item-1&workspace=60000000-0000-4000-8000-000000000006#current-venue-planning");
    expect(getPlanningHubItemStageHref(item({ categoryId: "photography" })))
      .toBe("/planning-hub/photography?planItem=item-1#current-photographer-planning");
  });

  it("does not route an inactive supplier category into an unavailable stage", () => {
    expect(getPlanningHubItemStageRoute(item({
      categoryId: "videography",
      supplierType: "Videographer",
    }))).toBeNull();
  });
});
