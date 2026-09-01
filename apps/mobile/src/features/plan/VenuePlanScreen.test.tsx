import { render } from "@testing-library/react-native";
import { addManualVenue } from "../venues/venue-plan-actions";
import { createDevicePlan } from "../../planning/device-plan-model";
import { VenuePlanScreen } from "./VenuePlanScreen";

jest.mock("../../design/use-app-theme", () => ({
  useAppTheme: () => ({ colors: {
    canvas: "#fff", canvasRaised: "#fff", primary: "#173526", onPrimary: "#fff",
    accent: "#9C542D", text: "#222", textMuted: "#666", border: "#ccc",
    successSurface: "#eee", focus: "#f60",
  } }),
}));

describe("VenuePlanScreen", () => {
  it("shows the shortlist separately from the chosen venue and budget", async () => {
    const base = createDevicePlan({
      weddingDate: null,
      location: "Fife",
      guestCount: 80,
      totalBudgetPence: 2_000_000,
      priorities: ["venue"],
      weddingSeason: "Summer 2027",
    });
    const data = addManualVenue(base, "Village Hall", 250_000);
    const view = await render(<VenuePlanScreen data={data} onDiscover={jest.fn()} onPayments={jest.fn()} onTasks={jest.fn()} />);

    expect(view.getByRole("header", { name: "Village Hall" })).toBeOnTheScreen();
    expect(view.getByText("Estimated shortlist · Added manually")).toBeOnTheScreen();
    expect(view.getByText("No payment recorded")).toBeOnTheScreen();
    expect(view.getByText("Availability not checked")).toBeOnTheScreen();
    expect(view.getByLabelText(/Budget remaining £17,500/)).toBeOnTheScreen();
    expect(view.queryByText("CHOSEN")).not.toBeOnTheScreen();
    expect(view.getByRole("button", { name: "Manage tasks" })).toBeOnTheScreen();
    expect(view.getByRole("button", { name: "Manage payments" })).toBeOnTheScreen();
  });
});
