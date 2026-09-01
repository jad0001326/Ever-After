import { describe, expect, it } from "vitest";

import type { BudgetItem, PaymentInstallment } from "./types";
import {
  createPaymentInstallment,
  getEditablePaymentInstallments,
  getPaymentScheduleTotals,
  validatePersistedPaymentSchedule,
  validatePaymentSchedule,
} from "./payment-schedule";

describe("portable payment schedules", () => {
  it("turns legacy aggregate payment fields into stable editable rows", () => {
    const item = budgetItem({
      depositPaidPence: 20_000,
      totalPaidPence: 35_000,
      dueDate: "2027-04-01",
    });

    expect(getEditablePaymentInstallments(item)).toEqual([
      expect.objectContaining({
        id: `legacy-deposit-${item.id}`,
        kind: "deposit",
        amountPence: 20_000,
        paidPence: 20_000,
      }),
      expect.objectContaining({
        id: `legacy-paid-${item.id}`,
        label: "Payment already recorded",
        paidPence: 15_000,
      }),
      expect.objectContaining({
        id: `legacy-due-${item.id}`,
        label: "Next payment",
        dueDate: "2027-04-01",
      }),
    ]);
  });

  it("creates independently addressable rows and totals known and unknown amounts", () => {
    const deposit = {
      ...createPaymentInstallment("deposit", "deposit-1"),
      amountPence: 50_000,
      paidPence: 50_000,
    };
    const final = {
      ...createPaymentInstallment("final", "final-1"),
      amountPence: null,
    };

    expect(getPaymentScheduleTotals([deposit, final])).toEqual({
      scheduledPence: 50_000,
      paidPence: 50_000,
      unknownAmountCount: 1,
    });
  });

  it("rejects invalid calendar dates and contradictory paid amounts", () => {
    const installment: PaymentInstallment = {
      ...createPaymentInstallment("installment", "payment-1"),
      amountPence: 25_000,
      paidPence: 30_000,
      dueDate: "2027-02-30",
      paidAt: "2027/02/01",
    };

    expect(validatePaymentSchedule(budgetItem(), [installment]).map(({ code }) => code))
      .toEqual(expect.arrayContaining([
        "invalid_due_date",
        "invalid_paid_date",
        "paid_exceeds_installment",
      ]));
  });

  it("requires stable IDs and a recorded item cost before accepting payment amounts", () => {
    const installment: PaymentInstallment = {
      ...createPaymentInstallment("installment", ""),
      amountPence: 25_000,
    };

    expect(validatePaymentSchedule(
      budgetItem({ confirmedCostPence: null }),
      [installment],
    ).map(({ code }) => code)).toEqual(expect.arrayContaining([
      "missing_installment_id",
      "item_cost_required",
    ]));
  });

  it("blocks schedule and paid totals that exceed the item's valid cost", () => {
    const installments: PaymentInstallment[] = [
      {
        ...createPaymentInstallment("deposit", "deposit-1"),
        amountPence: 60_000,
        paidPence: 60_000,
      },
      {
        ...createPaymentInstallment("final", "final-1"),
        amountPence: 60_000,
        paidPence: 50_000,
      },
    ];

    expect(validatePaymentSchedule(budgetItem(), installments).map(({ code }) => code))
      .toEqual(expect.arrayContaining([
        "scheduled_exceeds_item_cost",
        "paid_exceeds_item_cost",
      ]));
  });

  it("rejects persisted aggregate fields that contradict their payment rows", () => {
    const item = budgetItem({
      installments: [{
        ...createPaymentInstallment("deposit", "deposit-1"),
        amountPence: 25_000,
        paidPence: 10_000,
        dueDate: "2027-04-01",
      }],
      depositPaidPence: 0,
      totalPaidPence: 0,
      dueDate: null,
      paymentStatus: "not_started",
      costStatus: "booked",
    });

    expect(validatePersistedPaymentSchedule(item).map(({ code }) => code))
      .toEqual(expect.arrayContaining([
        "payment_total_mismatch",
        "deposit_total_mismatch",
        "due_date_mismatch",
        "payment_status_mismatch",
        "cost_status_mismatch",
      ]));
  });

  it("retains valid payment history when its budget item is cancelled", () => {
    const item = budgetItem({
      installments: [{
        ...createPaymentInstallment("deposit", "deposit-1"),
        amountPence: 25_000,
        paidPence: 10_000,
        dueDate: "2027-04-01",
      }],
      depositPaidPence: 10_000,
      totalPaidPence: 10_000,
      dueDate: "2027-04-01",
      paymentStatus: "deposit_paid",
      bookingStatus: "cancelled",
      costStatus: "cancelled",
    });

    expect(validatePersistedPaymentSchedule(item)).toEqual([]);
  });
});

function budgetItem(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    categoryId: "venue",
    listingId: null,
    listingType: null,
    listingUrl: null,
    imageUrl: null,
    source: "manual",
    itemName: "Test venue",
    supplierName: "Test venue",
    supplierType: "Venue",
    description: null,
    estimatedCostPence: null,
    confirmedCostPence: 100_000,
    importedPricePence: null,
    importedPriceToPence: null,
    importedPriceType: null,
    costPerPersonPence: null,
    guestCount: null,
    depositPaidPence: 0,
    totalPaidPence: 0,
    installments: [],
    costStatus: "booked",
    paymentStatus: "not_started",
    bookingStatus: "booked",
    availabilityStatus: "not_checked",
    availabilityDate: null,
    dueDate: null,
    websiteUrl: null,
    notes: null,
    createdAt: "2026-08-31T08:00:00.000Z",
    updatedAt: "2026-08-31T08:00:00.000Z",
    sortOrder: 0,
    ...overrides,
  };
}
