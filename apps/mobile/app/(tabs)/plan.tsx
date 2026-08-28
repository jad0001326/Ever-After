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
  const data = connected.state.status === "connected"
    ? { ...state.record.data, budgetPlan: connected.state.hydration.budget.plan }
    : state.record.data;
  return <VenuePlanScreen data={data} onDiscover={() => router.push("/discover")} />;
}
