import { Redirect, useRouter } from "expo-router";
import { VenuePlanScreen } from "../../src/features/plan/VenuePlanScreen";
import { DevicePlanLoadingScreen } from "../../src/planning/DevicePlanLoadingScreen";
import { useDevicePlan } from "../../src/planning/DevicePlanProvider";

export default function PlanScreen() {
  const router = useRouter();
  const { state } = useDevicePlan();
  if (state.status === "loading") return <DevicePlanLoadingScreen />;
  if (state.status !== "ready") return <Redirect href="/(onboarding)" />;
  return <VenuePlanScreen data={state.record.data} onDiscover={() => router.push("/discover")} />;
}
