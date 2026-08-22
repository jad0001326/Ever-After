import { bindAuthRefreshToAppState } from "./auth-lifecycle";
import { createExpoSessionStorage } from "./expo-session-storage";
import { createNativeAuthRuntime } from "./native-auth-runtime";
import { createEverAftSupabaseClient } from "./supabase-client";

jest.mock("./auth-lifecycle", () => ({
  bindAuthRefreshToAppState: jest.fn(() => jest.fn()),
}));
jest.mock("./expo-session-storage", () => ({
  createExpoSessionStorage: jest.fn(() => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clearAll: jest.fn(),
  })),
}));
jest.mock("./supabase-client", () => ({
  createEverAftSupabaseClient: jest.fn(),
}));

describe("native auth runtime", () => {
  beforeEach(() => jest.clearAllMocks());

  it("binds refresh and starts restoration only once per app runtime", async () => {
    const getSession = jest.fn(async () => ({ data: { session: null }, error: null }));
    const onAuthStateChange = jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    }));
    jest.mocked(createEverAftSupabaseClient).mockReturnValue({
      auth: {
        getSession,
        exchangeCodeForSession: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        onAuthStateChange,
        startAutoRefresh: jest.fn(),
        stopAutoRefresh: jest.fn(),
      },
    } as never);

    const runtime = createNativeAuthRuntime({
      status: "configured",
      config: {
        url: "https://fixture-project.supabase.co",
        publishableKey: "sb_publishable_fixture",
      },
    });
    await Promise.all([runtime.start(), runtime.start()]);

    expect(createExpoSessionStorage).toHaveBeenCalledWith("production");
    expect(bindAuthRefreshToAppState).toHaveBeenCalledTimes(1);
    expect(onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot().status).toBe("signed_out");
  });

  it("waits for session restoration before starting foreground refresh", async () => {
    let completeRestore: (() => void) | undefined;
    const getSession = jest.fn(() => new Promise<{
      data: { session: null };
      error: null;
    }>((resolve) => {
      completeRestore = () => resolve({ data: { session: null }, error: null });
    }));
    jest.mocked(createEverAftSupabaseClient).mockReturnValue({
      auth: {
        getSession,
        exchangeCodeForSession: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
        startAutoRefresh: jest.fn(),
        stopAutoRefresh: jest.fn(),
      },
    } as never);

    const runtime = createNativeAuthRuntime({
      status: "configured",
      config: {
        url: "https://fixture-project.supabase.co",
        publishableKey: "sb_publishable_fixture",
      },
    });
    const restoring = runtime.start();

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(bindAuthRefreshToAppState).not.toHaveBeenCalled();

    completeRestore?.();
    await restoring;

    expect(bindAuthRefreshToAppState).toHaveBeenCalledTimes(1);
  });

  it("keeps an unconfigured build offline and fails closed", async () => {
    const runtime = createNativeAuthRuntime({ status: "not_configured", config: null });

    await expect(runtime.start()).resolves.toMatchObject({ status: "unavailable" });
    await expect(runtime.signInWithPassword("couple@example.com", "fixture-password"))
      .rejects.toEqual(expect.objectContaining({ failure: "auth_unavailable" }));
    expect(createEverAftSupabaseClient).not.toHaveBeenCalled();
  });
});
