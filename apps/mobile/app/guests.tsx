import { Redirect, useRouter } from "expo-router";
import { Linking } from "react-native";

import { resolveCatalogueRuntimeConfiguration } from "../src/catalogue/catalogue-runtime";
import { GuestTableSummaryScreen } from "../src/features/plan/GuestTableSummaryScreen";
import { useConnectedPlanning } from "../src/planning/ConnectedPlanningProvider";
import { DevicePlanLoadingScreen } from "../src/planning/DevicePlanLoadingScreen";
import { useDevicePlan } from "../src/planning/DevicePlanProvider";
import { buildPlanningTableHandoffUrl } from "../src/planning/planning-web-handoff";

export default function GuestsRoute() {
  const router = useRouter();
  const device = useDevicePlan();
  const connected = useConnectedPlanning();
  const configuration = resolveCatalogueRuntimeConfiguration(process.env.EXPO_PUBLIC_EVERAFT_API_URL);

  if (device.state.status === "loading") return <DevicePlanLoadingScreen />;
  if (device.state.status !== "ready") return <Redirect href="/(onboarding)" />;
  const data = connected.data ?? device.state.record.data;
  const url = configuration.status === "configured"
    ? buildPlanningTableHandoffUrl(configuration.baseUrl, data.workspace.cloudWorkspaceId)
    : null;
  return (
    <GuestTableSummaryScreen
      data={data}
      mode="guests"
      onBack={() => router.back()}
      onOpenWebPlanner={url ? () => Linking.openURL(url) : undefined}
    />
  );
}
