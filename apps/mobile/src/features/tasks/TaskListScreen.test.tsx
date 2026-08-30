import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { TaskListScreen } from "./TaskListScreen";

jest.mock("../../design/use-app-theme", () => ({
  useAppTheme: () => ({ colors: {
    canvas: "#fff", canvasRaised: "#fff", primary: "#173526", onPrimary: "#fff",
    accent: "#9C542D", text: "#222", textMuted: "#666", border: "#ccc",
    successSurface: "#eee", focus: "#f60",
  } }),
}));

const task = {
  id: "70000000-0000-4000-8000-000000000007",
  title: "Confirm guest numbers",
  notes: null,
  category: "guests" as const,
  status: "todo" as const,
  dueDate: null,
  sortOrder: 0,
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
};

describe("TaskListScreen", () => {
  afterEach(() => jest.restoreAllMocks());

  it("creates, updates and confirms deletion with accessible controls", async () => {
    const onCreate = jest.fn(async () => ({ outcome: "device_only" as const }));
    const onChangeStatus = jest.fn(async () => ({ outcome: "connected" as const }));
    const onDelete = jest.fn(async () => ({ outcome: "connected" as const }));
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const view = await render(
      <TaskListScreen
        onBack={jest.fn()}
        onChangeStatus={onChangeStatus}
        onCreate={onCreate}
        onDelete={onDelete}
        saving={false}
        storageLabel="On this device"
        tasks={[task]}
      />,
    );

    await fireEvent.changeText(view.getByLabelText("Task title"), "Book transport");
    await fireEvent.changeText(view.getByLabelText("Task due date"), "2027-06-01");
    await fireEvent.press(view.getByRole("button", { name: "Add task" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      title: "Book transport",
      dueDate: "2027-06-01",
    }));
    expect(view.getByText("Saved on this device.")).toBeOnTheScreen();

    await fireEvent.press(view.getByRole("button", { name: `Start task: ${task.title}` }));
    await waitFor(() => expect(onChangeStatus).toHaveBeenCalledWith(task));

    await fireEvent.press(view.getByRole("button", { name: `Delete task: ${task.title}` }));
    const buttons = alert.mock.calls[0][2]!;
    await act(async () => { buttons[1].onPress?.(); });
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(task.id));
  });

  it("keeps invalid task input local and explains the correction", async () => {
    const onCreate = jest.fn();
    const view = await render(
      <TaskListScreen
        onBack={jest.fn()}
        onChangeStatus={jest.fn()}
        onCreate={onCreate}
        onDelete={jest.fn()}
        saving={false}
        storageLabel="Connected to My EverAft"
        tasks={[]}
      />,
    );

    await fireEvent.changeText(view.getByLabelText("Task title"), "Book transport");
    await fireEvent.changeText(view.getByLabelText("Task due date"), "1 June");
    await fireEvent.press(view.getByRole("button", { name: "Add task" }));

    expect(view.getByText("Use YYYY-MM-DD for the due date.")).toBeOnTheScreen();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
