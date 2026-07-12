import type { BudgetItem, BudgetPlan } from "./types";

export type ItemCost = { amountPence: number | null; kind: "confirmed" | "estimated" | "per_person" | "missing" | "cancelled" };

export function getItemPlanningCost(item: BudgetItem): ItemCost {
  if (item.costStatus === "cancelled" || item.bookingStatus === "cancelled") return { amountPence: 0, kind: "cancelled" };
  if (item.confirmedCostPence != null) return { amountPence: item.confirmedCostPence, kind: "confirmed" };
  if (item.estimatedCostPence != null) return { amountPence: item.estimatedCostPence, kind: "estimated" };
  if (item.costPerPersonPence != null && item.guestCount != null) return { amountPence: item.costPerPersonPence * item.guestCount, kind: "per_person" };
  return { amountPence: null, kind: "missing" };
}

export function getContingencyPence(plan: BudgetPlan) {
  if (plan.contingencyType === "fixed") return Math.max(Math.round(plan.contingencyValue), 0);
  if (plan.contingencyType === "percentage") return Math.max(Math.round(plan.totalBudgetPence * (plan.contingencyValue / 100)), 0);
  return 0;
}

export function calculateBudget(plan: BudgetPlan) {
  let allocatedPence = 0, confirmedPence = 0, estimatedPence = 0, totalPaidPence = 0, missingPriceCount = 0, activeItemCount = 0;
  const categoryTotals = new Map<string, number>();
  for (const item of plan.items) {
    const cost = getItemPlanningCost(item);
    if (cost.kind === "cancelled") continue;
    activeItemCount += 1;
    totalPaidPence += Math.max(item.totalPaidPence, item.depositPaidPence, 0);
    if (cost.amountPence == null) { missingPriceCount += 1; continue; }
    allocatedPence += cost.amountPence;
    categoryTotals.set(item.categoryId, (categoryTotals.get(item.categoryId) ?? 0) + cost.amountPence);
    if (cost.kind === "confirmed") confirmedPence += cost.amountPence; else estimatedPence += cost.amountPence;
  }
  const contingencyPence = getContingencyPence(plan);
  const spendableBudgetPence = Math.max(plan.totalBudgetPence - contingencyPence, 0);
  const remainingPence = spendableBudgetPence - allocatedPence;
  const outstandingPence = Math.max(allocatedPence - totalPaidPence, 0);
  const percentUsed = spendableBudgetPence > 0 ? Math.round((allocatedPence / spendableBudgetPence) * 100) : 0;
  const largestCategories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([categoryId, amountPence]) => ({ categoryId, amountPence }));
  return { allocatedPence, confirmedPence, estimatedPence, totalPaidPence, outstandingPence, contingencyPence, spendableBudgetPence, remainingPence, percentUsed, missingPriceCount, activeItemCount, categoryTotals, largestCategories, health: remainingPence < 0 ? "over" : percentUsed >= 85 ? "close" : "healthy" } as const;
}

export function getPaymentStatus(costPence: number | null, paidPence: number) {
  if (costPence == null || paidPence <= 0) return "not_started" as const;
  if (paidPence >= costPence) return paidPence > costPence ? "overpaid" as const : "paid" as const;
  return "partially_paid" as const;
}

export function parseMoneyToPence(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const normalised = typeof value === "number" ? String(value) : value.replace(/[£,$\s]/g, "");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalised)) return null;
  const amount = Number(normalised);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function formatMoney(pence: number, currency = "GBP", maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits }).format(pence / 100);
}

export function findDuplicateImportedListing(items: BudgetItem[], listingId: string | null, excludeItemId?: string) {
  if (!listingId) return undefined;
  return items.find((item) => item.listingId === listingId && item.id !== excludeItemId);
}

