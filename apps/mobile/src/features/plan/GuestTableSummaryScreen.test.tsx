import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { createDevicePlan } from "../../planning/device-plan-model";
import { GuestTableSummaryScreen } from "./GuestTableSummaryScreen";

jest.mock("../../design/use-app-theme", () => ({
  useAppTheme: () => ({ colors: {
    canvas: "#fff", canvasRaised: "#fff", primary: "#173526", onPrimary: "#fff",
    accent: "#9C542D", text: "#222", textMuted: "#666", border: "#ccc",
  } }),
}));

describe("GuestTableSummaryScreen", () => {
  it("shows privacy-safe guest counts and opens the connected web handoff", async () => {
    const onOpenWebPlanner = jest.fn(async () => undefined);
    const data = connectedPlan();
    const view = await render(
      <GuestTableSummaryScreen
        data={data}
        mode="guests"
        onBack={jest.fn()}
        onOpenWebPlanner={onOpenWebPlanner}
      />,
    );

    expect(view.getByRole("header", { name: "Guests" })).toBeOnTheScreen();
    expect(view.getByLabelText("Total guests: 2")).toBeOnTheScreen();
    expect(view.getByLabelText("Accepted: 1")).toBeOnTheScreen();
    expect(view.queryByText("ailsa@example.com")).not.toBeOnTheScreen();

    fireEvent.press(view.getByRole("button", { name: "Open connected web planner" }));
    await waitFor(() => expect(onOpenWebPlanner).toHaveBeenCalledTimes(1));
  });

  it("makes the device-only public planner boundary explicit", async () => {
    const data = createDevicePlan({
      weddingDate: null,
      weddingSeason: null,
      location: null,
      guestCount: 80,
      totalBudgetPence: 2_000_000,
      priorities: [],
    });
    const view = await render(
      <GuestTableSummaryScreen data={data} mode="tables" onBack={jest.fn()} />,
    );

    expect(view.getByRole("header", { name: "Tables" })).toBeOnTheScreen();
    expect(view.getByText("Use the separate public web planner")).toBeOnTheScreen();
    expect(view.getByText(/does not sync into the public web planner/i)).toBeOnTheScreen();
  });
});

function connectedPlan() {
  const base = createDevicePlan({
    weddingDate: null,
    weddingSeason: null,
    location: null,
    guestCount: 80,
    totalBudgetPence: 2_000_000,
    priorities: [],
  });
  return {
    ...base,
    workspace: {
      ...base.workspace,
      cloudWorkspaceId: "60000000-0000-4000-8000-000000000006",
      tablePlan: {
        ...base.workspace.tablePlan,
        guests: [{
          id: "81000000-0000-4000-8000-000000000008",
          name: "Ailsa",
          email: "ailsa@example.com",
          rsvpStatus: "accepted" as const,
          dietaryNotes: "Vegetarian",
          tableId: base.workspace.tablePlan.tables[0].id,
          seatIndex: 0,
        }, {
          id: "82000000-0000-4000-8000-000000000008",
          name: "Ben",
          rsvpStatus: "pending" as const,
          tableId: null,
          seatIndex: null,
        }],
      },
    },
  };
}
