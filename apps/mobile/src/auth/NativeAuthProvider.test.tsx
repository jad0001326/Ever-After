import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import type { AuthSessionSnapshot } from "./auth-session-controller";
import { NativeAuthProvider, useNativeAuth } from "./NativeAuthProvider";
import type { NativeAuthRuntime } from "./native-auth-runtime";

jest.mock("./native-auth-runtime", () => ({
  getDefaultNativeAuthRuntime: jest.fn(),
}));

function Probe() {
  const auth = useNativeAuth();
  return <Text>{`${auth.availability}:${auth.snapshot.status}`}</Text>;
}

describe("NativeAuthProvider", () => {
  it("subscribes before one-time startup and publishes session changes", async () => {
    let snapshot: AuthSessionSnapshot = {
      status: "idle",
      accountId: null,
      reason: null,
    };
    let listener: ((next: AuthSessionSnapshot) => void) | null = null;
    const start = jest.fn(async () => snapshot);
    const runtime: NativeAuthRuntime = {
      availability: "configured",
      start,
      getSnapshot: () => snapshot,
      subscribe(next) { listener = next; return () => { listener = null; }; },
      signInWithPassword: jest.fn(),
      completeCallback: jest.fn(),
      rememberIntendedDestination: jest.fn(),
      signOutFromDevice: jest.fn(),
      signOutEverywhere: jest.fn(),
    };
    const view = await render(
      <NativeAuthProvider runtime={runtime}><Probe /></NativeAuthProvider>,
    );
    expect(view.getByText("configured:idle")).toBeOnTheScreen();
    expect(start).toHaveBeenCalledTimes(1);

    snapshot = { status: "authenticated", accountId: "account-a", reason: null };
    await act(() => listener?.(snapshot));
    expect(view.getByText("configured:authenticated")).toBeOnTheScreen();
  });
});
