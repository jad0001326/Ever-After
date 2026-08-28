import { fireEvent, render } from "@testing-library/react-native";

import { TodayScreen } from "./TodayScreen";
import { createDevicePlan } from "../../planning/device-plan-model";

describe("TodayScreen", () => {
  it("renders an honest local status, useful recommendation and accessible action", async () => {
    const onOpenRecommendation = jest.fn();
    const data = createDevicePlan({
      weddingDate: null,
      weddingSeason: null,
      location: null,
      guestCount: 80,
      totalBudgetPence: 2_000_000,
      priorities: [],
    });
    const view = await render(<TodayScreen data={data} onOpenRecommendation={onOpenRecommendation} saving={false} />);

    expect(view.getByLabelText("Storage status: On this device")).toBeOnTheScreen();
    expect(view.getByRole("header", { name: "Choose a venue" })).toBeOnTheScreen();
    expect(view.getByRole("button", { name: "Explore venues" })).toHaveProp(
      "accessibilityHint",
      "Opens venue discovery",
    );
    expect(view.getByLabelText("Remaining: £20,000")).toBeOnTheScreen();
    fireEvent.press(view.getByRole("button", { name: "Explore venues" }));
    expect(onOpenRecommendation).toHaveBeenCalledTimes(1);
    expect(onOpenRecommendation).toHaveBeenCalledWith("venues");
  });

  it("announces a successfully hydrated connected workspace", async () => {
    const data = createDevicePlan({
      weddingDate: null,
      weddingSeason: null,
      location: null,
      guestCount: 80,
      totalBudgetPence: 2_000_000,
      priorities: [],
    });
    const view = await render(
      <TodayScreen
        data={data}
        onOpenRecommendation={jest.fn()}
        saving={false}
        storageLabel="Connected to My EverAft"
      />,
    );
    expect(view.getByLabelText("Storage status: Connected to My EverAft")).toBeOnTheScreen();
  });
});
