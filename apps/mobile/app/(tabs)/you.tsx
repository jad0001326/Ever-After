import { useRouter } from "expo-router";

import { useNativeAuth } from "../../src/auth/NativeAuthProvider";
import { YouScreen as YouAccountScreen } from "../../src/features/account/YouScreen";
import { useConnectedPlanning } from "../../src/planning/ConnectedPlanningProvider";

export default function YouScreen() {
  const auth = useNativeAuth();
  const router = useRouter();
  const connected = useConnectedPlanning();
  const authenticated = auth.snapshot.status === "authenticated";
  const storageLabel = connected.state.status === "connected"
    ? connected.state.syncStatus === "saving" ? "Saving to My EverAft" : "Connected to My EverAft"
    : connected.state.status === "checking" ? "Checking connection" : "On this device";
  const connectionMessage = connected.state.status === "connected"
    ? connected.state.syncStatus === "saving"
      ? "Your change is saved on this device and is now syncing securely to My EverAft."
      : `Workspace loaded securely as ${connected.state.role}. Budget changes sync through the connected workspace and are reflected in Today and Plan.`
    : connected.state.status === "checking"
      ? "Checking this account for the matching wedding workspace."
      : connected.state.status === "error"
        ? "The connected plan could not be reached. Your device plan remains available and unchanged."
        : undefined;
  return (
    <YouAccountScreen
      availability={auth.availability}
      onSignIn={() => router.push("/auth/sign-in")}
      sessionStatus={auth.snapshot.status}
      storageLabel={storageLabel}
      connectionMessage={connectionMessage}
      onConnect={authenticated && connected.state.status === "device_only" && connected.state.reason === "no_workspace"
        ? () => { void connected.connect(); }
        : undefined}
      onRefresh={authenticated && (connected.state.status === "connected" || connected.state.status === "error")
        ? () => { void connected.refresh(); }
        : undefined}
    />
  );
}
