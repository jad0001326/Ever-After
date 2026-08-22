import { fireEvent, render } from "@testing-library/react-native";

import { TodayScreen } from "./TodayScreen";

describe("TodayScreen", () => {
  it("renders an honest local status, useful recommendation and accessible action", async () => {
    const onExploreVenues = jest.fn();
    const view = await render(<TodayScreen onExploreVenues={onExploreVenues} />);

    expect(view.getByLabelText("Storage status: On this device")).toBeOnTheScreen();
    expect(view.getByRole("header", { name: "Choose a venue" })).toBeOnTheScreen();
    expect(view.getByRole("button", { name: "Explore venues" })).toHaveProp(
      "accessibilityHint",
      "Opens venue discovery",
    );
    expect(view.getByLabelText("Remaining: £20,000")).toBeOnTheScreen();
    fireEvent.press(view.getByRole("button", { name: "Explore venues" }));
    expect(onExploreVenues).toHaveBeenCalledTimes(1);
  });
});
