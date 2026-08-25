import { AppState } from "react-native";

import {
  AuthSessionError,
  createAuthSessionController,
  type AuthSessionSnapshot,
} from "./auth-session-controller";
import { bindAuthRefreshToAppState, type AppStateValue } from "./auth-lifecycle";
import { createExpoSessionStorage } from "./expo-session-storage";
import { createIntendedDestinationStore } from "./intended-destination";
import {
  readBundledNativeAuthConfiguration,
  type NativeAuthConfiguration,
} from "./native-auth-config";
import { createEverAftSupabaseClient } from "./supabase-client";

export type NativeAuthAvailability = NativeAuthConfiguration["status"];

export type NativeAuthRuntime = Readonly<{
  availability: NativeAuthAvailability;
  start(): Promise<AuthSessionSnapshot>;
  getSnapshot(): AuthSessionSnapshot;
  subscribe(listener: (next: AuthSessionSnapshot) => void): () => void;
  getAccessToken(): Promise<string | null>;
  signInWithPassword(email: string, password: string): Promise<string | null>;
  completeCallback(rawUrl: string): Promise<string | null>;
  rememberIntendedDestination(path: string): boolean;
  signOutFromDevice(): Promise<void>;
  signOutEverywhere(): Promise<void>;
}>;

let defaultRuntime: NativeAuthRuntime | null = null;

export function getDefaultNativeAuthRuntime() {
  defaultRuntime ??= createNativeAuthRuntime(readBundledNativeAuthConfiguration());
  return defaultRuntime;
}

export function createNativeAuthRuntime(
  configuration: NativeAuthConfiguration,
): NativeAuthRuntime {
  if (configuration.status !== "configured") {
    return createUnavailableRuntime(configuration.status);
  }

  const storage = createExpoSessionStorage("production");
  const client = createEverAftSupabaseClient(configuration.config, storage);
  const intendedDestinationStore = createIntendedDestinationStore();
  const controller = createAuthSessionController(client.auth, {
    clearLocalSecrets: storage.clearAll,
    intendedDestinationStore,
  });
  let startPromise: Promise<AuthSessionSnapshot> | null = null;
  let refreshBound = false;

  function bindRefreshAfterRestore() {
    if (!refreshBound) {
      bindAuthRefreshToAppState(client.auth, {
        get currentState() { return normalizeAppState(AppState.currentState); },
        addEventListener(_event, listener) {
          const subscription = AppState.addEventListener("change", (state) => {
            listener(normalizeAppState(state));
          });
          return { remove: () => subscription.remove() };
        },
      });
      refreshBound = true;
    }
  }

  function start() {
    startPromise ??= controller.start()
      .then((snapshot) => {
        // Starting auto-refresh before Supabase has restored its persisted
        // session makes the first timer contend with the restoration lock.
        bindRefreshAfterRestore();
        return snapshot;
      })
      .catch(() => controller.getSnapshot());
    return startPromise;
  }

  return Object.freeze({
    availability: "configured" as const,
    start,
    getSnapshot: controller.getSnapshot,
    subscribe: controller.subscribe,
    getAccessToken: controller.getAccessToken,
    signInWithPassword: controller.signInWithPassword,
    completeCallback: controller.completeCallback,
    rememberIntendedDestination: controller.rememberIntendedDestination,
    signOutFromDevice: controller.signOutFromDevice,
    signOutEverywhere: controller.signOutEverywhere,
  });
}

function createUnavailableRuntime(
  availability: Exclude<NativeAuthAvailability, "configured">,
): NativeAuthRuntime {
  const snapshot: AuthSessionSnapshot = Object.freeze({
    status: "unavailable",
    accountId: null,
    reason: null,
  });
  const unavailable = async (): Promise<never> => {
    throw new AuthSessionError("auth_unavailable");
  };
  return Object.freeze({
    availability,
    start: async () => snapshot,
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    getAccessToken: async () => null,
    signInWithPassword: unavailable,
    completeCallback: unavailable,
    rememberIntendedDestination: () => false,
    signOutFromDevice: unavailable,
    signOutEverywhere: unavailable,
  });
}

function normalizeAppState(state: string): AppStateValue {
  return state === "active" || state === "background" || state === "inactive"
    ? state
    : "unknown";
}
