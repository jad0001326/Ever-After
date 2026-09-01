import { createPaymentInstallment } from "@everaft/planning-domain/budget/payment-schedule";
import { updatePlanningHubItemInstallments } from "@everaft/planning-domain/planning-hub/plan";
import { addManualVenue } from "../venues/venue-plan-actions";
import { createDevicePlan } from "../../planning/device-plan-model";
import { createTodayModel } from "./seeded-today";

describe("seeded Today model", () => {
  it("derives the first recommendation and budget from shared domain rules", () => {
    const model = createTodayModel(createDevicePlan({
      weddingDate: null,
      weddingSeason: null,
      location: null,
      guestCount: 80,
      totalBudgetPence: 2_000_000,
      priorities: [],
    }, new Date("2026-08-20T09:00:00.000Z")), new Date("2026-08-20T09:00:00.000Z"));

    expect(model.storageLabel).toBe("On this device");
    expect(model.recommendation).toMatchObject({
      title: "Choose a venue",
      actionLabel: "Explore venues",
      destination: { kind: "venues" },
    });
    expect(model.budget).toEqual({
      total: "£20,000",
      remaining: "£20,000",
      committed: "£0",
      paid: "£0",
    });
    expect(model.comingUp).toEqual([]);
  });

  it("prioritises an overdue payment and surfaces the closest payment and task deadlines", () => {
    const base = addManualVenue(createDevicePlan({
      weddingDate: "2027-08-21",
      weddingSeason: null,
      location: "Fife",
      guestCount: 80,
      totalBudgetPence: 2_000_000,
      priorities: ["venue"],
    }), "Village Hall", 400_000);
    const item = base.budgetPlan.items[0];
    const data = {
      ...base,
      budgetPlan: updatePlanningHubItemInstallments(base.budgetPlan, item.id, [{
        ...createPaymentInstallment("deposit", "deposit-1"),
        amountPence: 100_000,
        paidPence: 25_000,
        dueDate: "2027-01-15",
      }]),
      workspace: {
        ...base.workspace,
        tasks: [{
          id: "80000000-0000-4000-8000-000000000008",
          title: "Confirm readings",
          notes: null,
          category: "general" as const,
          status: "todo" as const,
          dueDate: "2027-01-20",
          sortOrder: 0,
          createdAt: "2026-08-31T10:00:00.000Z",
          updatedAt: "2026-08-31T10:00:00.000Z",
        }],
      },
    };
    const model = createTodayModel(data, new Date("2027-02-01T12:00:00.000Z"));

    expect(model.recommendation).toMatchObject({
      title: "Review Village Hall payment",
      actionLabel: "Review payment",
      destination: { kind: "payments", itemId: item.id },
    });
    expect(model.comingUp).toEqual([
      expect.objectContaining({
        kind: "payment",
        title: "Village Hall: Deposit",
        detail: expect.stringContaining("£750 outstanding"),
        destination: { kind: "payments", itemId: item.id },
      }),
      expect.objectContaining({
        kind: "task",
        title: "Confirm readings",
        destination: { kind: "tasks" },
      }),
    ]);
  });
});
