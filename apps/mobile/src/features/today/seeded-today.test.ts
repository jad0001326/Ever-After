import { createSeededTodayModel } from "./seeded-today";

describe("seeded Today model", () => {
  it("derives the first recommendation and budget from shared domain rules", () => {
    const model = createSeededTodayModel();

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
