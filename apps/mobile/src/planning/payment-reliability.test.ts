import { createPaymentInstallment } from "@everaft/planning-domain/budget/payment-schedule";

import { addManualVenue } from "../features/venues/venue-plan-actions";
import { createDevicePlan } from "./device-plan-model";
import {
  budgetPlanContentMatches,
  withDevicePaymentSchedule,
} from "./payment-reliability";

describe("native payment reliability", () => {
  it("updates the device copy first while preserving derived aggregate fields", () => {
    const base = addManualVenue(createDevicePlan({
      weddingDate: "2027-08-21",
      weddingSeason: null,
      location: "Fife",
      guestCount: 80,
      totalBudgetPence: 2_000_000,
      priorities: ["venue"],
    }), "Village Hall", 400_000);
    const item = base.budgetPlan.items[0];
    const result = withDevicePaymentSchedule(base, item.id, [{
      ...createPaymentInstallment("deposit", "deposit-1"),
      amountPence: 100_000,
      paidPence: 50_000,
      dueDate: "2027-02-01",
    }]);

    expect(result.budgetPlan.items[0]).toMatchObject({
      installments: [expect.objectContaining({ id: "deposit-1" })],
      depositPaidPence: 50_000,
      totalPaidPence: 50_000,
      dueDate: "2027-02-01",
      paymentStatus: "deposit_paid",
      costStatus: "deposit_paid",
    });
  });

  it("recognises an already-applied connected write despite the server version change", () => {
    const intended = createDevicePlan({
      weddingDate: null,
      weddingSeason: null,
      location: null,
      guestCount: 80,
      totalBudgetPence: 2_000_000,
      priorities: [],
    }).budgetPlan;
    const canonical = {
      ...intended,
      updatedAt: "2026-08-31T12:00:00.000Z",
    };

    expect(budgetPlanContentMatches(canonical, intended)).toBe(true);
    expect(budgetPlanContentMatches(
      { ...canonical, totalBudgetPence: intended.totalBudgetPence + 1 },
      intended,
    )).toBe(false);
  });
});
