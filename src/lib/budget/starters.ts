import { createEmptyBudgetPlan } from "./persistence";
import type { BudgetItem, BudgetPlan } from "./types";

type StarterAllocation = {
  categoryId: string;
  itemName: string;
  amountPence: number;
};

export type BudgetStarter = {
  slug: "15000" | "20000" | "30000";
  label: string;
  title: string;
  description: string;
  totalBudgetPence: number;
  suggestedGuests: number;
  allocations: readonly StarterAllocation[];
};

export const budgetStarters: readonly BudgetStarter[] = [
  {
    slug: "15000",
    label: "£15k starter",
    title: "Lean and intentional",
    description: "A focused plan for around 60 guests, protecting the venue, food and photography while keeping the supporting details disciplined.",
    totalBudgetPence: 1_500_000,
    suggestedGuests: 60,
    allocations: [
      { categoryId: "venue", itemName: "Venue estimate", amountPence: 400_000 },
      { categoryId: "catering", itemName: "Food and catering estimate", amountPence: 300_000 },
      { categoryId: "photography", itemName: "Photography estimate", amountPence: 120_000 },
      { categoryId: "wedding-dress", itemName: "Wedding outfit estimate", amountPence: 100_000 },
      { categoryId: "formalwear", itemName: "Suits and formalwear estimate", amountPence: 40_000 },
      { categoryId: "flowers", itemName: "Flowers and styling estimate", amountPence: 70_000 },
      { categoryId: "dj-band", itemName: "Music estimate", amountPence: 80_000 },
      { categoryId: "cake", itemName: "Cake estimate", amountPence: 30_000 },
      { categoryId: "stationery", itemName: "Stationery estimate", amountPence: 20_000 },
      { categoryId: "rings", itemName: "Wedding rings estimate", amountPence: 60_000 },
      { categoryId: "registrar-celebrant", itemName: "Ceremony and celebrant estimate", amountPence: 45_000 },
      { categoryId: "hair-makeup", itemName: "Hair and makeup estimate", amountPence: 30_000 },
      { categoryId: "insurance", itemName: "Wedding insurance estimate", amountPence: 10_000 },
      { categoryId: "miscellaneous", itemName: "Other wedding costs", amountPence: 45_000 }
    ]
  },
  {
    slug: "20000",
    label: "£20k starter",
    title: "Balanced celebration",
    description: "A balanced starting point for around 80 guests, with more room for personal details without losing sight of the main costs.",
    totalBudgetPence: 2_000_000,
    suggestedGuests: 80,
    allocations: [
      { categoryId: "venue", itemName: "Venue estimate", amountPence: 600_000 },
      { categoryId: "catering", itemName: "Food and catering estimate", amountPence: 400_000 },
      { categoryId: "photography", itemName: "Photography estimate", amountPence: 160_000 },
      { categoryId: "wedding-dress", itemName: "Wedding outfit estimate", amountPence: 140_000 },
      { categoryId: "formalwear", itemName: "Suits and formalwear estimate", amountPence: 60_000 },
      { categoryId: "flowers", itemName: "Flowers and styling estimate", amountPence: 100_000 },
      { categoryId: "dj-band", itemName: "Music estimate", amountPence: 100_000 },
      { categoryId: "cake", itemName: "Cake estimate", amountPence: 40_000 },
      { categoryId: "stationery", itemName: "Stationery estimate", amountPence: 30_000 },
      { categoryId: "rings", itemName: "Wedding rings estimate", amountPence: 80_000 },
      { categoryId: "registrar-celebrant", itemName: "Ceremony and celebrant estimate", amountPence: 50_000 },
      { categoryId: "hair-makeup", itemName: "Hair and makeup estimate", amountPence: 40_000 },
      { categoryId: "insurance", itemName: "Wedding insurance estimate", amountPence: 15_000 }
    ]
  },
  {
    slug: "30000",
    label: "£30k starter",
    title: "More room to personalise",
    description: "A more flexible example for around 100 guests, allowing greater venue, food, styling and entertainment choices.",
    totalBudgetPence: 3_000_000,
    suggestedGuests: 100,
    allocations: [
      { categoryId: "venue", itemName: "Venue estimate", amountPence: 900_000 },
      { categoryId: "catering", itemName: "Food and catering estimate", amountPence: 600_000 },
      { categoryId: "photography", itemName: "Photography estimate", amountPence: 220_000 },
      { categoryId: "wedding-dress", itemName: "Wedding outfit estimate", amountPence: 220_000 },
      { categoryId: "formalwear", itemName: "Suits and formalwear estimate", amountPence: 80_000 },
      { categoryId: "flowers", itemName: "Flowers and styling estimate", amountPence: 160_000 },
      { categoryId: "dj-band", itemName: "Music estimate", amountPence: 150_000 },
      { categoryId: "cake", itemName: "Cake estimate", amountPence: 60_000 },
      { categoryId: "stationery", itemName: "Stationery estimate", amountPence: 45_000 },
      { categoryId: "rings", itemName: "Wedding rings estimate", amountPence: 120_000 },
      { categoryId: "registrar-celebrant", itemName: "Ceremony and celebrant estimate", amountPence: 65_000 },
      { categoryId: "hair-makeup", itemName: "Hair and makeup estimate", amountPence: 50_000 },
      { categoryId: "insurance", itemName: "Wedding insurance estimate", amountPence: 20_000 }
    ]
  }
] as const;

export function getBudgetStarter(slug: string) {
  return budgetStarters.find((starter) => starter.slug === slug);
}

export function createStarterBudgetPlan(starter: BudgetStarter, userId: string | null = null): BudgetPlan {
  const timestamp = "2026-07-15T00:00:00.000Z";
  const base = createEmptyBudgetPlan(userId);
  const items: BudgetItem[] = starter.allocations.map((allocation, index) => ({
    id: `starter-${starter.slug}-${allocation.categoryId}`,
    categoryId: allocation.categoryId,
    listingId: null,
    listingType: null,
    listingUrl: null,
    imageUrl: null,
    source: "manual",
    itemName: allocation.itemName,
    supplierName: null,
    supplierType: null,
    description: "Planning example — replace this estimate with your own research or supplier quote.",
    estimatedCostPence: allocation.amountPence,
    confirmedCostPence: null,
    importedPricePence: null,
    importedPriceToPence: null,
    importedPriceType: null,
    costPerPersonPence: null,
    guestCount: null,
    depositPaidPence: 0,
    totalPaidPence: 0,
    costStatus: "estimated",
    paymentStatus: "not_started",
    bookingStatus: "researching",
    dueDate: null,
    websiteUrl: null,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    sortOrder: index
  }));
  const targets = new Map(starter.allocations.map((allocation) => [allocation.categoryId, allocation.amountPence]));

  return {
    ...base,
    id: `starter-${starter.slug}`,
    name: `${starter.label} wedding budget`,
    scenarioName: starter.label,
    totalBudgetPence: starter.totalBudgetPence,
    guestCount: starter.suggestedGuests,
    contingencyType: "percentage",
    contingencyValue: 5,
    createdAt: timestamp,
    updatedAt: timestamp,
    categories: base.categories.map((category) => ({
      ...category,
      targetPence: targets.get(category.id) ?? null,
      collapsed: !targets.has(category.id)
    })),
    items
  };
}
