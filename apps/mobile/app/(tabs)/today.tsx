import { Redirect, useRouter } from "expo-router";

import { TodayScreen } from "../../src/features/today/TodayScreen";
import { DevicePlanLoadingScreen } from "../../src/planning/DevicePlanLoadingScreen";
import { useDevicePlan } from "../../src/planning/DevicePlanProvider";

export default function TodayRoute() {
  const router = useRouter();
  const { state } = useDevicePlan();

  if (state.status === "loading") return <DevicePlanLoadingScreen />;
  if (state.status !== "ready") return <Redirect href="/(onboarding)" />;

  return <TodayScreen data={state.record.data} onExploreVenues={() => router.push("/discover")} saving={state.saving} />;
}
