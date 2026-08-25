import { Redirect } from "expo-router";

import { DevicePlanLoadingScreen } from "../src/planning/DevicePlanLoadingScreen";
import { useDevicePlan } from "../src/planning/DevicePlanProvider";

export default function Index() {
  const { state } = useDevicePlan();
  if (state.status === "loading") return <DevicePlanLoadingScreen />;
  return <Redirect href={state.status === "ready" ? "/(tabs)/today" : "/(onboarding)"} />;
}
