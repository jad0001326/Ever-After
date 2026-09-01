import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createPaymentInstallment } from "@everaft/planning-domain/budget/payment-schedule";
import { updatePlanningHubItemInstallments } from "@everaft/planning-domain/planning-hub/plan";

import { addManualVenue } from "../venues/venue-plan-actions";
import { createDevicePlan, type DevicePlanData } from "../../planning/device-plan-model";
import { PaymentScheduleScreen } from "./PaymentScheduleScreen";

jest.mock("../../design/use-app-theme", () => ({
  useAppTheme: () => ({ colors: {
    canvas: "#fff", canvasRaised: "#fff", primary: "#173526", onPrimary: "#fff",
    accent: "#9C542D", text: "#222", textMuted: "#666", border: "#ccc",
    successSurface: "#eee", focus: "#f60",
  } }),
}));

describe("PaymentScheduleScreen", () => {
  it("records a payment on the device-first plan and derives its aggregate state", async () => {
    const data = planWithVenue();
    const onSave = jest.fn(async (_data: DevicePlanData) => ({ outcome: "device_only" as const }));
    const view = await render(
      <PaymentScheduleScreen
        data={data}
        onBack={jest.fn()}
        onSave={onSave}
        referenceDate={new Date("2027-01-20T12:00:00.000Z")}
      />,
    );

    await fireEvent.press(view.getByRole("button", { name: "Add payment" }));
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount due"), "1000");
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount paid"), "500");
    await fireEvent.changeText(view.getByLabelText("Payment 1 due date"), "2027-02-01");
    await fireEvent.press(view.getByRole("button", { name: "Save payment schedule" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0];
    expect(saved.budgetPlan.items[0]).toMatchObject({
      installments: [expect.objectContaining({
        label: "Instalment",
        amountPence: 100_000,
        paidPence: 50_000,
        dueDate: "2027-02-01",
      })],
      totalPaidPence: 50_000,
      dueDate: "2027-02-01",
      paymentStatus: "partially_paid",
    });
    expect(view.getByRole("alert")).toHaveTextContent(/saved on this device/i);
  });

  it("keeps the save confirmation when the persisted item receives a new version timestamp", async () => {
    const data = planWithVenue();
    const onSave = jest.fn(async (_data: DevicePlanData) => ({ outcome: "device_only" as const }));
    const onBack = jest.fn();
    const view = await render(
      <PaymentScheduleScreen data={data} onBack={onBack} onSave={onSave} />,
    );

    await fireEvent.press(view.getByRole("button", { name: "Add payment" }));
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount due"), "1000");
    await fireEvent.press(view.getByRole("button", { name: "Save payment schedule" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const saved = onSave.mock.calls[0][0];
    const refreshed = {
      ...saved,
      budgetPlan: {
        ...saved.budgetPlan,
        items: saved.budgetPlan.items.map((item) => ({
          ...item,
          updatedAt: "2099-01-01T00:00:00.000Z",
        })),
      },
    };
    await view.rerender(
      <PaymentScheduleScreen data={refreshed} onBack={onBack} onSave={onSave} />,
    );

    expect(view.getByRole("alert")).toHaveTextContent(/saved on this device/i);
    expect(view.getByLabelText("Payment 1 amount due")).toHaveDisplayValue("1000");
  });

  it("opens the requested payment when its connected item arrives after device hydration", async () => {
    const local = planWithVenue();
    const hydrated = addManualVenue(local, "Hydrated Castle", 600_000);
    const requested = hydrated.budgetPlan.items.at(-1);
    expect(requested).toBeDefined();
    const onBack = jest.fn();
    const onSave = jest.fn(async (_data: DevicePlanData) => ({ outcome: "connected" as const }));
    const view = await render(
      <PaymentScheduleScreen
        data={local}
        initialItemId={requested?.id}
        onBack={onBack}
        onSave={onSave}
      />,
    );

    expect(view.getByRole("header", { name: "Village Hall" })).toBeOnTheScreen();
    await view.rerender(
      <PaymentScheduleScreen
        data={hydrated}
        initialItemId={requested?.id}
        onBack={onBack}
        onSave={onSave}
      />,
    );

    expect(view.getByRole("header", { name: "Hydrated Castle" })).toBeOnTheScreen();
    expect(view.getByRole("button", { name: /Hydrated Castle/, selected: true })).toBeOnTheScreen();
  });

  it("does not overwrite a changed same-item cloud schedule with a dirty device draft", async () => {
    const local = planWithVenue();
    const item = local.budgetPlan.items[0];
    const hydrated = {
      ...local,
      budgetPlan: updatePlanningHubItemInstallments(local.budgetPlan, item.id, [{
        ...createPaymentInstallment("deposit", "canonical-deposit"),
        amountPence: 20_000,
      }]),
    };
    const onSave = jest.fn(async (_data: DevicePlanData) => ({ outcome: "connected" as const }));
    const onBack = jest.fn();
    const view = await render(
      <PaymentScheduleScreen data={local} onBack={onBack} onSave={onSave} />,
    );
    await fireEvent.press(view.getByRole("button", { name: "Add payment" }));
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount due"), "100");

    await view.rerender(
      <PaymentScheduleScreen data={hydrated} onBack={onBack} onSave={onSave} />,
    );
    await waitFor(() => expect(view.getByRole("alert")).toHaveTextContent(/changed while you were editing/i));
    expect(view.getByLabelText("Payment 1 amount due")).toHaveDisplayValue("100");
    await fireEvent.press(view.getByRole("button", { name: "Save payment schedule" }));
    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.press(view.getByRole("button", { name: "Load latest schedule" }));
    expect(view.getByLabelText("Payment 1 amount due")).toHaveDisplayValue("200");
    expect(view.getByRole("alert")).toHaveTextContent(/latest My EverAft payment schedule loaded/i);
  });

  it("preserves sequential decimal entry until it is committed as pence", async () => {
    const onSave = jest.fn(async (_data: DevicePlanData) => ({ outcome: "device_only" as const }));
    const view = await render(
      <PaymentScheduleScreen data={planWithVenue()} onBack={jest.fn()} onSave={onSave} />,
    );
    await fireEvent.press(view.getByRole("button", { name: "Add payment" }));
    await fireEvent(view.getByLabelText("Payment 1 amount due"), "focus");
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount due"), "1");
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount due"), "1.");
    expect(view.getByLabelText("Payment 1 amount due")).toHaveDisplayValue("1.");
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount due"), "1.5");
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount due"), "1.50");
    expect(view.getByLabelText("Payment 1 amount due")).toHaveDisplayValue("1.50");
    await fireEvent(view.getByLabelText("Payment 1 amount due"), "blur");

    await fireEvent.press(view.getByRole("button", { name: "Save payment schedule" }));
    await waitFor(() => expect(view.getByRole("alert")).toHaveTextContent(/saved on this device/i));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].budgetPlan.items[0].installments[0].amountPence).toBe(150);
  });

  it("blocks invalid dates before persistence", async () => {
    const onSave = jest.fn(async (_data: DevicePlanData) => ({ outcome: "connected" as const }));
    const view = await render(
      <PaymentScheduleScreen data={planWithVenue()} onBack={jest.fn()} onSave={onSave} />,
    );
    await fireEvent.press(view.getByRole("button", { name: "Add payment" }));
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount due"), "5000");
    await fireEvent.changeText(view.getByLabelText("Payment 1 due date"), "2027-02-30");
    await fireEvent.press(view.getByRole("button", { name: "Save payment schedule" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(view.getByRole("alert")).toHaveTextContent(/real date in YYYY-MM-DD format/i);
  });

  it("blocks a schedule that allocates more than the recorded item cost", async () => {
    const onSave = jest.fn(async (_data: DevicePlanData) => ({ outcome: "connected" as const }));
    const view = await render(
      <PaymentScheduleScreen data={planWithVenue()} onBack={jest.fn()} onSave={onSave} />,
    );
    await fireEvent.press(view.getByRole("button", { name: "Add payment" }));
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount due"), "5000");
    await fireEvent.changeText(view.getByLabelText("Payment 1 due date"), "2027-03-01");
    await fireEvent.press(view.getByRole("button", { name: "Save payment schedule" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(view.getByRole("alert")).toHaveTextContent(/cannot exceed the recorded item cost/i);
  });

  it("requires an item cost before recording payment amounts", async () => {
    const data = planWithVenue();
    const costless = {
      ...data,
      budgetPlan: {
        ...data.budgetPlan,
        items: data.budgetPlan.items.map((item) => ({
          ...item,
          estimatedCostPence: null,
          confirmedCostPence: null,
        })),
      },
    };
    const onSave = jest.fn(async (_data: DevicePlanData) => ({ outcome: "device_only" as const }));
    const view = await render(
      <PaymentScheduleScreen data={costless} onBack={jest.fn()} onSave={onSave} />,
    );
    await fireEvent.press(view.getByRole("button", { name: "Add payment" }));
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount due"), "100");
    await fireEvent.press(view.getByRole("button", { name: "Save payment schedule" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(view.getByRole("alert")).toHaveTextContent(/item cost before recording payment amounts/i);
  });

  it("marks a known payment paid today with an accessible explicit action", async () => {
    const onSave = jest.fn(async (_data: DevicePlanData) => ({ outcome: "connected" as const }));
    const view = await render(
      <PaymentScheduleScreen
        data={planWithVenue()}
        onBack={jest.fn()}
        onSave={onSave}
        referenceDate={new Date("2027-01-20T12:00:00.000Z")}
      />,
    );
    await fireEvent.press(view.getByRole("button", { name: "Add payment" }));
    await fireEvent.changeText(view.getByLabelText("Payment 1 amount due"), "1000");
    await fireEvent.press(view.getByRole("button", { name: "Mark paid today" }));
    await fireEvent.press(view.getByRole("button", { name: "Save payment schedule" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].budgetPlan.items[0].installments[0]).toMatchObject({
      paidPence: 100_000,
      paidAt: "2027-01-20",
    });
  });
});

function planWithVenue() {
  return addManualVenue(createDevicePlan({
    weddingDate: "2027-08-21",
    weddingSeason: null,
    location: "Fife",
    guestCount: 80,
    totalBudgetPence: 2_000_000,
    priorities: ["venue"],
  }), "Village Hall", 400_000);
}
