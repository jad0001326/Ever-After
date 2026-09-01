import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { PaymentScheduleScreen } from "../src/features/payments/PaymentScheduleScreen";
import { useConnectedPlanning } from "../src/planning/ConnectedPlanningProvider";
import { DevicePlanLoadingScreen } from "../src/planning/DevicePlanLoadingScreen";
import { useDevicePlan } from "../src/planning/DevicePlanProvider";

export default function PaymentsRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ itemId?: string | string[] }>();
  const device = useDevicePlan();
  const connected = useConnectedPlanning();

  if (device.state.status === "loading") return <DevicePlanLoadingScreen />;
  if (device.state.status !== "ready") return <Redirect href="/(onboarding)" />;

  return (
    <PaymentScheduleScreen
      data={connected.data ?? device.state.record.data}
      initialItemId={typeof params.itemId === "string" ? params.itemId : null}
      onBack={() => router.back()}
      onSave={connected.saveBudget}
    />
  );
}
