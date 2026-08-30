import { Redirect, useRouter } from "expo-router";

import { TodayScreen } from "../../src/features/today/TodayScreen";
import { DevicePlanLoadingScreen } from "../../src/planning/DevicePlanLoadingScreen";
import { useDevicePlan } from "../../src/planning/DevicePlanProvider";
import { useConnectedPlanning } from "../../src/planning/ConnectedPlanningProvider";

export default function TodayRoute() {
  const router = useRouter();
  const { state } = useDevicePlan();
  const connected = useConnectedPlanning();

  if (state.status === "loading") return <DevicePlanLoadingScreen />;
  if (state.status !== "ready") return <Redirect href="/(onboarding)" />;

  const data = connected.data ?? state.record.data;
  const storageLabel = connected.state.status === "connected"
    ? connected.state.syncStatus === "saving" ? "Saving to My EverAft" : "Connected to My EverAft"
    : connected.state.status === "checking" ? "Checking connection" : "On this device";
  return <TodayScreen data={data} onOpenRecommendation={(destination) => router.push(destination === "photography" ? "/suppliers/photography" : destination === "plan" ? "/plan" : "/discover")} saving={state.saving} storageLabel={storageLabel} />;
}
