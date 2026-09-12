import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import { createDevicePlan } from "../../planning/device-plan-model";
import { GuestListScreen } from "./GuestListScreen";

jest.mock("../../design/use-app-theme", () => ({
  useAppTheme: () => ({ colors: { canvas: "#fff", canvasRaised: "#fff", primary: "#173526", onPrimary: "#fff", textMuted: "#555", border: "#ccc" } }),
}));

function plan() {
  return createDevicePlan({ weddingDate: null, weddingSeason: null, location: null, guestCount: 80, totalBudgetPence: 2000000, priorities: [] }).workspace.tablePlan;
}

it("explains device-only saving and exposes connection review without changing guest data", async () => {
  const onSave = jest.fn();
  const onReviewConnection = jest.fn();
  const view = await render(<GuestListScreen plan={plan()} saving={false} onSave={onSave} onBack={jest.fn()} />);
  expect(view.getByText("Device-only plan")).toBeOnTheScreen();
  expect(view.getByText(/do not automatically appear in a separate web plan/)).toBeOnTheScreen();
  await view.rerender(<GuestListScreen plan={plan()} saving={false} onSave={onSave} onBack={jest.fn()} connectionStatus="needs_attention" onReviewConnection={onReviewConnection} />);
  await fireEvent.press(view.getByRole("button", { name: "Review connection" }));
  expect(onReviewConnection).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
});

it("announces an in-flight save and disables duplicate submission", async () => {
  let finish: (() => void) | undefined;
  const onSave = jest.fn(() => new Promise<{ outcome: "device_only" }>((resolve) => {
    finish = () => resolve({ outcome: "device_only" });
  }));
  const view = await render(<GuestListScreen plan={plan()} saving={false} onSave={onSave} onBack={jest.fn()} />);
  await fireEvent.changeText(view.getByLabelText("Guest names to add"), "Ailsa");
  await fireEvent.press(view.getByRole("button", { name: "Add guests" }));
  expect(view.getByText("Saving guests…")).toBeOnTheScreen();
  expect(view.getByRole("button", { name: "Add guests" })).toBeDisabled();
  await act(async () => { finish?.(); });
  expect(view.getByText("Saved on this device.")).toBeOnTheScreen();
  expect(onSave).toHaveBeenCalledTimes(1);
});

it("deletes from the latest plan with the latest save callback after confirmation", async () => {
  const base = plan();
  base.guests = [
    { id: "81000000-0000-4000-8000-000000000008", name: "Ailsa", email: "ailsa@example.com", tableId: null, seatIndex: null },
    { id: "82000000-0000-4000-8000-000000000008", name: "Ben", tableId: null, seatIndex: null },
  ];
  base.rules = [{ id: "83000000-0000-4000-8000-000000000008", personAId: base.guests[0].id, personBId: base.guests[1].id, type: "prefer_next_to" }];
  const oldSave = jest.fn(async (_next: typeof base) => ({ outcome: "device_only" as const }));
  const latestSave = jest.fn(async (_next: typeof base) => ({ outcome: "device_only" as const }));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  try {
    const view = await render(<GuestListScreen plan={base} saving={false} onSave={oldSave} onBack={jest.fn()} />);
    await fireEvent.changeText(view.getByLabelText("Search guests"), "ailsa@example");
    expect(view.queryByRole("button", { name: "Edit Ben" })).not.toBeOnTheScreen();
    await fireEvent.press(view.getByRole("button", { name: "Delete Ailsa" }));
    expect(oldSave).not.toHaveBeenCalled();
    const latest = {
      ...base,
      guests: [...base.guests, { id: "84000000-0000-4000-8000-000000000008", name: "Catriona", tableId: null, seatIndex: null }],
    };
    await view.rerender(<GuestListScreen plan={latest} saving={false} onSave={latestSave} onBack={jest.fn()} />);
    await act(async () => { alert.mock.calls[0][2]![1].onPress?.(); });
    expect(oldSave).not.toHaveBeenCalled();
    expect(latestSave.mock.calls[0][0].guests).toEqual([base.guests[1], latest.guests[2]]);
    expect(latestSave.mock.calls[0][0].rules).toEqual([]);
  } finally {
    alert.mockRestore();
  }
});

it("does not delete a guest changed while confirmation is open", async () => {
  const base = plan();
  base.guests = [{ id: "81000000-0000-4000-8000-000000000008", name: "Ailsa", tableId: null, seatIndex: null }];
  const onSave = jest.fn(async (_next: typeof base) => ({ outcome: "device_only" as const }));
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  try {
    const view = await render(<GuestListScreen plan={base} saving={false} onSave={onSave} onBack={jest.fn()} />);
    await fireEvent.press(view.getByRole("button", { name: "Delete Ailsa" }));
    await view.rerender(<GuestListScreen plan={{ ...base, guests: [{ ...base.guests[0], name: "Ailsa Campbell" }] }} saving={false} onSave={onSave} onBack={jest.fn()} />);
    await act(async () => { alert.mock.calls[0][2]![1].onPress?.(); });
    expect(onSave).not.toHaveBeenCalled();
    expect(view.getByText(/changed while you were confirming deletion/i)).toBeOnTheScreen();
  } finally {
    alert.mockRestore();
  }
});

it("bulk adds guests and clears input only after a successful save", async () => {
  const onSave = jest.fn(async () => ({ outcome: "device_only" as const }));
  const view = await render(<GuestListScreen plan={plan()} saving={false} onSave={onSave} onBack={jest.fn()} />);
  await fireEvent.changeText(view.getByLabelText("Guest names to add"), "Ailsa\nBen");
  await fireEvent.press(view.getByRole("button", { name: "Add guests" }));
  expect(onSave.mock.calls[0]).toBeDefined();
  expect(view.getByText("Saved on this device.")).toBeOnTheScreen();
  expect(view.getByLabelText("Guest names to add")).toHaveProp("value", "");
});

it("preserves an open edit instead of overwriting refreshed guest details", async () => {
  const base = plan();
  base.guests = [{ id: "81000000-0000-4000-8000-000000000008", name: "Ailsa", tableId: null, seatIndex: null }];
  const onSave = jest.fn();
  const view = await render(<GuestListScreen plan={base} saving={false} onSave={onSave} onBack={jest.fn()} />);
  await fireEvent.press(view.getByRole("button", { name: "Edit Ailsa" }));
  await fireEvent.changeText(view.getByLabelText("Guest name"), "Ailsa Fraser");
  await view.rerender(<GuestListScreen plan={{ ...base, guests: [{ ...base.guests[0], name: "Ailsa Campbell" }] }} saving={false} onSave={onSave} onBack={jest.fn()} />);
  await fireEvent.press(view.getByRole("button", { name: "Save guest" }));
  expect(onSave).not.toHaveBeenCalled();
  expect(view.getByLabelText("Guest name")).toHaveProp("value", "Ailsa Fraser");
  expect(view.getByText(/This guest changed while you were editing/)).toBeOnTheScreen();
});

it("clears bulk input when the device saved but cloud sync failed", async () => {
  const onSave = jest.fn(async () => ({ outcome: "needs_attention" as const, savedOnDevice: true }));
  const view = await render(<GuestListScreen plan={plan()} saving={false} onSave={onSave} onBack={jest.fn()} />);
  await fireEvent.changeText(view.getByLabelText("Guest names to add"), "Ailsa");
  await fireEvent.press(view.getByRole("button", { name: "Add guests" }));
  expect(view.getByLabelText("Guest names to add")).toHaveProp("value", "");
  expect(view.getByText("Saved on this device. Cloud sync needs attention.")).toBeOnTheScreen();
});

it("retains input after an unexpected storage failure without exposing error details", async () => {
  const onSave = jest.fn(async () => { throw new Error("private transport detail"); });
  const view = await render(<GuestListScreen plan={plan()} saving={false} onSave={onSave} onBack={jest.fn()} />);
  await fireEvent.changeText(view.getByLabelText("Guest names to add"), "Ailsa");
  await fireEvent.press(view.getByRole("button", { name: "Add guests" }));
  expect(view.getByLabelText("Guest names to add")).toHaveProp("value", "Ailsa");
  expect(view.getByText(/Could not save/)).toBeOnTheScreen();
  expect(view.queryByText("private transport detail")).not.toBeOnTheScreen();
});

it("unseats an edited guest when declining and keeps private details out of collapsed rows", async () => {
  const base = plan();
  base.guests = [{ id: "81000000-0000-4000-8000-000000000008", name: "Ailsa", email: "ailsa@example.com", dietaryNotes: "Nut allergy", rsvpStatus: "accepted", tableId: base.tables[0].id, seatIndex: 0 }];
  const onSave = jest.fn(async (_next: typeof base) => ({ outcome: "connected" as const }));
  const view = await render(<GuestListScreen plan={base} saving={false} onSave={onSave} onBack={jest.fn()} />);
  expect(view.queryByText("Nut allergy")).not.toBeOnTheScreen();
  await fireEvent.press(view.getByRole("button", { name: "Edit Ailsa" }));
  await fireEvent.press(view.getByRole("radio", { name: "declined" }));
  await fireEvent.press(view.getByRole("button", { name: "Save guest" }));
  expect(onSave.mock.calls[0][0].guests[0]).toMatchObject({ rsvpStatus: "declined", tableId: null, seatIndex: null });
});
