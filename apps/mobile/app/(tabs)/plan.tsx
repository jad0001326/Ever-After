import { Redirect, useRouter } from "expo-router";
import { VenuePlanScreen } from "../../src/features/plan/VenuePlanScreen";
import { DevicePlanLoadingScreen } from "../../src/planning/DevicePlanLoadingScreen";
import { useDevicePlan } from "../../src/planning/DevicePlanProvider";
import { useConnectedPlanning } from "../../src/planning/ConnectedPlanningProvider";

export default function PlanScreen() {
  const router = useRouter();
  const { state } = useDevicePlan();
  const connected = useConnectedPlanning();
  if (state.status === "loading") return <DevicePlanLoadingScreen />;
  if (state.status !== "ready") return <Redirect href="/(onboarding)" />;
  return (
    <VenuePlanScreen
      data={connected.data ?? state.record.data}
      onDiscover={() => router.push("/discover")}
      onPayments={() => router.push("/payments")}
      onTasks={() => router.push("/tasks")}
    />
  );
}
