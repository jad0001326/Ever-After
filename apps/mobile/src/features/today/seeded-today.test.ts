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
    });
    expect(model.budget).toEqual({
      total: "£20,000",
      remaining: "£20,000",
      committed: "£0",
      paid: "£0",
    });
    expect(model.comingUp).toBe("No deadlines yet");
  });
});
