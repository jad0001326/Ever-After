import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import type { AuthSessionSnapshot } from "./auth-session-controller";
import {
  getDefaultNativeAuthRuntime,
  type NativeAuthRuntime,
} from "./native-auth-runtime";

export type NativeAuthContextValue = Readonly<{
  availability: NativeAuthRuntime["availability"];
  snapshot: AuthSessionSnapshot;
  signInWithPassword(email: string, password: string): Promise<string | null>;
  completeCallback(rawUrl: string): Promise<string | null>;
  rememberIntendedDestination(path: string): boolean;
  signOutFromDevice(): Promise<void>;
  signOutEverywhere(): Promise<void>;
}>;

const NativeAuthContext = createContext<NativeAuthContextValue | null>(null);

export function NativeAuthProvider({
  children,
  runtime,
}: PropsWithChildren<{ runtime?: NativeAuthRuntime }>) {
  const activeRuntime = useMemo(() => runtime ?? getDefaultNativeAuthRuntime(), [runtime]);
  const snapshot = useSyncExternalStore(
    activeRuntime.subscribe,
    activeRuntime.getSnapshot,
    activeRuntime.getSnapshot,
  );

  useEffect(() => {
    void activeRuntime.start();
  }, [activeRuntime]);

  const value = useMemo<NativeAuthContextValue>(() => ({
    availability: activeRuntime.availability,
    snapshot,
    signInWithPassword: activeRuntime.signInWithPassword,
    completeCallback: activeRuntime.completeCallback,
    rememberIntendedDestination: activeRuntime.rememberIntendedDestination,
    signOutFromDevice: activeRuntime.signOutFromDevice,
    signOutEverywhere: activeRuntime.signOutEverywhere,
  }), [activeRuntime, snapshot]);

  return <NativeAuthContext.Provider value={value}>{children}</NativeAuthContext.Provider>;
}

export function useNativeAuth() {
  const value = useContext(NativeAuthContext);
  if (!value) throw new Error("useNativeAuth must be used within NativeAuthProvider.");
  return value;
}
