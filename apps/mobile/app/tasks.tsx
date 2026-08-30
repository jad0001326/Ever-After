import { Redirect, useRouter } from "expo-router";

import { TaskListScreen } from "../src/features/tasks/TaskListScreen";
import { useConnectedPlanning } from "../src/planning/ConnectedPlanningProvider";
import { DevicePlanLoadingScreen } from "../src/planning/DevicePlanLoadingScreen";
import { useDevicePlan } from "../src/planning/DevicePlanProvider";
import { nextTaskStatus } from "../src/planning/task-reliability";

export default function TasksRoute() {
  const router = useRouter();
  const device = useDevicePlan();
  const connected = useConnectedPlanning();

  if (device.state.status === "loading") return <DevicePlanLoadingScreen />;
  if (device.state.status !== "ready") return <Redirect href="/(onboarding)" />;

  const data = connected.data ?? device.state.record.data;
  const storageLabel = connected.state.status === "connected"
    ? connected.state.syncStatus === "saving" ? "Saving to My EverAft" : "Connected to My EverAft"
    : connected.state.status === "checking" ? "Checking connection" : "On this device";
  return (
    <TaskListScreen
      onBack={() => router.back()}
      onChangeStatus={(task) => connected.updateTask(task.id, { status: nextTaskStatus(task.status) })}
      onCreate={connected.createTask}
      onDelete={connected.deleteTask}
      saving={device.state.saving || (connected.state.status === "connected" && connected.state.syncStatus === "saving")}
      storageLabel={storageLabel}
      tasks={data.workspace.tasks}
    />
  );
}
