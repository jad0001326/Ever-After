import { z } from "zod";
const nullableMoney = z.number().int().min(0).max(1_000_000_000).nullable();
export const budgetPlanSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().min(1).max(100), userId: z.string().nullable(), name: z.string().min(1).max(120),
  totalBudgetPence: z.number().int().min(0).max(1_000_000_000), currency: z.enum(["GBP", "EUR", "USD"]), weddingDate: z.string().max(20).nullable(),
  guestCount: z.number().int().positive().max(10000).nullable(), location: z.string().max(160).nullable(), contingencyType: z.enum(["none", "fixed", "percentage"]),
  contingencyValue: z.number().min(0).max(1_000_000_000), createdAt: z.string(), updatedAt: z.string(), selectedVenueId: z.string().max(100).nullable(), scenarioName: z.string().max(80),
  categories: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(100), isCustom: z.boolean(), suggestedPercentage: z.number().min(0).max(100).optional(), targetPence: nullableMoney, collapsed: z.boolean() })).max(100),
  items: z.array(z.object({
    id: z.string().min(1).max(100), categoryId: z.string().min(1).max(100), listingId: z.string().max(100).nullable(), listingType: z.string().max(80).nullable(), listingUrl: z.string().max(500).nullable(), imageUrl: z.string().max(1000).nullable(), source: z.enum(["manual", "website"]), itemName: z.string().min(1).max(160), supplierName: z.string().max(160).nullable(), supplierType: z.string().max(100).nullable(), description: z.string().max(2000).nullable(),
    estimatedCostPence: nullableMoney, confirmedCostPence: nullableMoney, importedPricePence: nullableMoney, importedPriceToPence: nullableMoney,
    importedPriceType: z.enum(["fixed", "starting_from", "per_person", "package", "range", "quote_required", "unavailable"]).nullable(), costPerPersonPence: nullableMoney,
    guestCount: z.number().int().positive().max(10000).nullable(), depositPaidPence: z.number().int().min(0).max(1_000_000_000), totalPaidPence: z.number().int().min(0).max(1_000_000_000),
    costStatus: z.enum(["estimated", "quoted", "booked", "deposit_paid", "partially_paid", "paid", "cancelled"]), paymentStatus: z.enum(["not_started", "deposit_paid", "partially_paid", "paid", "overpaid"]), bookingStatus: z.enum(["researching", "shortlisted", "quoted", "booked", "cancelled"]), dueDate: z.string().max(20).nullable(), websiteUrl: z.string().max(500).nullable(), notes: z.string().max(4000).nullable(), createdAt: z.string(), updatedAt: z.string(), sortOrder: z.number().int().min(0)
  })).max(500)
});

