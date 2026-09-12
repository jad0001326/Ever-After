import { Redirect, useRouter } from "expo-router";

import { GuestListScreen } from "../src/features/plan/GuestListScreen";
import { useConnectedPlanning } from "../src/planning/ConnectedPlanningProvider";
import { DevicePlanLoadingScreen } from "../src/planning/DevicePlanLoadingScreen";
import { useDevicePlan } from "../src/planning/DevicePlanProvider";

export default function GuestsRoute() {
  const router = useRouter();
  const device = useDevicePlan();
  const connected = useConnectedPlanning();

  if (device.state.status === "loading") return <DevicePlanLoadingScreen />;
  if (device.state.status !== "ready") return <Redirect href="/(onboarding)" />;
  const data = connected.data ?? device.state.record.data;
  return (
    <GuestListScreen
      plan={data.workspace.tablePlan}
      onSave={connected.saveTablePlan}
      saving={device.state.saving || (connected.state.status === "connected" && connected.state.syncStatus === "saving")}
      onBack={() => router.back()}
      connectionStatus={connected.state.status === "error" ? "needs_attention" : connected.state.status}
      onReviewConnection={() => router.push("/(tabs)/you")}
    />
  );
}
