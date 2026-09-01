import { Redirect, useRouter } from "expo-router";

import { TodayScreen } from "../../src/features/today/TodayScreen";
import { DevicePlanLoadingScreen } from "../../src/planning/DevicePlanLoadingScreen";
import { useDevicePlan } from "../../src/planning/DevicePlanProvider";
import { useConnectedPlanning } from "../../src/planning/ConnectedPlanningProvider";
import type { TodayDestination } from "../../src/features/today/seeded-today";

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
  function openDestination(destination: TodayDestination) {
    if (destination.kind === "photography") router.push("/suppliers/photography");
    else if (destination.kind === "venues") router.push("/discover");
    else if (destination.kind === "payments") router.push(`/payments?itemId=${encodeURIComponent(destination.itemId)}`);
    else if (destination.kind === "tasks") router.push("/tasks");
    else if (destination.kind === "guests") router.push("/guests");
    else if (destination.kind === "tables") router.push("/tables");
    else router.push("/plan");
  }

  return <TodayScreen data={data} onOpenDestination={openDestination} saving={state.saving} storageLabel={storageLabel} />;
}
