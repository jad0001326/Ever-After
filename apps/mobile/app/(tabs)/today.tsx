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

  const data = connected.state.status === "connected"
    ? {
      ...state.record.data,
      budgetPlan: connected.state.hydration.budget.plan,
      workspace: {
        ...state.record.data.workspace,
        name: connected.state.hydration.dashboard.workspace.name,
        profile: connected.state.hydration.profile.profile ?? state.record.data.workspace.profile,
      },
    }
    : state.record.data;
  const storageLabel = connected.state.status === "connected"
    ? "Connected to My EverAft"
    : connected.state.status === "checking" ? "Checking connection" : "On this device";
  return <TodayScreen data={data} onExploreVenues={() => router.push("/discover")} saving={state.saving} storageLabel={storageLabel} />;
}
