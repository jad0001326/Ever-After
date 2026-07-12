import type { BudgetCategory } from "./types";

export const DEFAULT_CATEGORY_DEFINITIONS = [
  ["venue", "Venue", 30], ["catering", "Catering", 18], ["drinks", "Drinks", 7],
  ["wedding-dress", "Wedding dress", 5], ["formalwear", "Suits and formalwear", 3],
  ["photography", "Photography", 8], ["videography", "Videography", 4],
  ["entertainment", "Entertainment", 2], ["dj-band", "DJ or band", 4], ["flowers", "Flowers", 5],
  ["decor", "Styling and décor", 4], ["cake", "Cake", 2], ["stationery", "Stationery", 2],
  ["transport", "Transport", 2], ["hair-makeup", "Hair and makeup", 2], ["rings", "Rings", 3],
  ["ceremony-fees", "Ceremony fees", 1], ["registrar-celebrant", "Registrar or celebrant", 1],
  ["accommodation", "Accommodation", undefined], ["honeymoon", "Honeymoon", undefined],
  ["insurance", "Insurance", 1], ["gifts-favours", "Gifts and favours", 1], ["childcare", "Childcare", undefined],
  ["additional-staff", "Additional staff", undefined], ["marquee", "Marquee or structure", undefined],
  ["furniture-hire", "Furniture and equipment hire", undefined], ["lighting", "Lighting", undefined],
  ["heating", "Heating", undefined], ["toilets", "Toilets", undefined], ["miscellaneous", "Miscellaneous", 3],
  ["contingency", "Contingency", 5]
] as const;

export function createDefaultCategories(): BudgetCategory[] {
  return DEFAULT_CATEGORY_DEFINITIONS.map(([id, name, suggestedPercentage]) => ({
    id, name, isCustom: false, suggestedPercentage, targetPence: null,
    collapsed: !["venue", "photography", "catering"].includes(id)
  }));
}

