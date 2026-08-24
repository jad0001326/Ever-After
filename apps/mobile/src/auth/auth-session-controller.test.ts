import {
  AuthSessionError,
  createAuthSessionController,
  type AuthClientBoundary,
  type AuthSession,
} from "./auth-session-controller";
import { createIntendedDestinationStore } from "./intended-destination";

const activeSession = (token = "access-one", accountId = "account-a"): AuthSession => ({
  access_token: token,
  expires_at: 2_000,
  user: { id: accountId },
});

function createAuthFixture(initial: AuthSession | null = null) {
  let listener: ((event: string, session: AuthSession | null) => void) | null = null;
  let signOutResolve: ((value: { error: Error | null }) => void) | null = null;
  const calls: unknown[] = [];
  const auth: AuthClientBoundary = {
    async getSession() {
      calls.push("getSession");
      return { data: { session: initial }, error: null };
    },
    async exchangeCodeForSession(code) {
      calls.push(["exchange", code]);
      return { data: { session: activeSession("callback-token") }, error: null };
    },
    async signInWithPassword(credentials) {
      calls.push(["signIn", credentials.email, credentials.password]);
      return { data: { session: activeSession("password-token") }, error: null };
    },
    signOut(options) {
      calls.push(["signOut", options.scope]);
      return new Promise((resolve) => { signOutResolve = resolve; });
    },
    onAuthStateChange(next) {
      listener = next;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    },
  };
  return {
    auth,
    calls,
    emit(event: string, session: AuthSession | null) {
      listener?.(event, session);
    },
    finishSignOut(error: Error | null = null) {
      signOutResolve?.({ error });
    },
  };
}

function createDeferredRestoreFixture() {
  let listener: ((event: string, session: AuthSession | null) => void) | null = null;
  let finishRestore: ((session: AuthSession | null) => void) | null = null;
  const unsubscribe = jest.fn();
  const auth: AuthClientBoundary = {
    getSession: () => new Promise((resolve) => {
      finishRestore = (session) => resolve({ data: { session }, error: null });
    }),
    exchangeCodeForSession: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange(next) {
      listener = next;
      return { data: { subscription: { unsubscribe } } };
    },
  };
  return {
    auth,
    unsubscribe,
    emit(event: string, session: AuthSession | null) { listener?.(event, session); },
    finishRestore(session: AuthSession | null) { finishRestore?.(session); },
  };
}

describe("createAuthSessionController", () => {
  it("cold-restores a usable session without exposing its token in the snapshot", async () => {
    const fixture = createAuthFixture(activeSession());
    const controller = createAuthSessionController(fixture.auth, { now: () => 1_000_000 });

    await controller.start();

    expect(controller.getSnapshot()).toEqual({
      status: "authenticated",
      accountId: "account-a",
      reason: null,
    });
    expect(JSON.stringify(controller.getSnapshot())).not.toContain("access-one");
    await expect(controller.getAccessToken()).resolves.toBe("access-one");
  });

  it("rejects an expired restored session", async () => {
    const fixture = createAuthFixture({ ...activeSession(), expires_at: 999 });
    const controller = createAuthSessionController(fixture.auth, { now: () => 1_000_000 });

    await controller.start();

    expect(controller.getSnapshot()).toMatchObject({ status: "signed_out", reason: "expired" });
    await expect(controller.getAccessToken()).resolves.toBeNull();
  });

  it("rotates the bearer token and isolates an account switch", async () => {
    const fixture = createAuthFixture(activeSession());
    const controller = createAuthSessionController(fixture.auth, { now: () => 1_000_000 });
    await controller.start();

    fixture.emit("TOKEN_REFRESHED", activeSession("access-two"));
    await expect(controller.getAccessToken()).resolves.toBe("access-two");

    fixture.emit("SIGNED_IN", activeSession("account-b-token", "account-b"));
    expect(controller.getSnapshot().accountId).toBe("account-b");
    await expect(controller.getAccessToken()).resolves.toBe("account-b-token");
  });

  it("does not let a stale restore overwrite a newer auth event", async () => {
    const fixture = createDeferredRestoreFixture();
    const controller = createAuthSessionController(fixture.auth, { now: () => 1_000_000 });

    const restoring = controller.start();
    fixture.emit("SIGNED_IN", activeSession("new-token", "account-b"));
    fixture.finishRestore(activeSession("stale-token", "account-a"));
    await restoring;

    expect(controller.getSnapshot().accountId).toBe("account-b");
    await expect(controller.getAccessToken()).resolves.toBe("new-token");
  });

  it("does not restore private state after the controller has stopped", async () => {
    const fixture = createDeferredRestoreFixture();
    const controller = createAuthSessionController(fixture.auth, { now: () => 1_000_000 });

    const restoring = controller.start();
    controller.stop();
    fixture.finishRestore(activeSession());
    await restoring;

    expect(fixture.unsubscribe).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().status).toBe("idle");
    await expect(controller.getAccessToken()).resolves.toBeNull();
  });

  it("exchanges a strict PKCE callback and returns only its safe destination", async () => {
    const fixture = createAuthFixture();
    const controller = createAuthSessionController(fixture.auth, { now: () => 1_000_000 });

    await expect(controller.completeCallback(
      "myeveraft://auth/callback?code=valid-code&next=%2Fplan%2Ftasks%2Ftask-1",
    )).resolves.toBe("/plan/tasks/task-1");
    expect(fixture.calls).toContainEqual(["exchange", "valid-code"]);
    await expect(controller.getAccessToken()).resolves.toBe("callback-token");
  });

  it("consumes a superseded remembered destination when the callback supplies one", async () => {
    const fixture = createAuthFixture();
    const intendedDestinationStore = createIntendedDestinationStore();
    const controller = createAuthSessionController(fixture.auth, { intendedDestinationStore });
    controller.rememberIntendedDestination("/plan/tasks/old-task");

    await expect(controller.completeCallback(
      "myeveraft://auth/callback?code=valid-code&next=%2Fplan%2Ftasks%2Fnew-task",
    )).resolves.toBe("/plan/tasks/new-task");
    await expect(controller.signInWithPassword("couple@example.com", "fixture-password"))
      .resolves.toBeNull();
  });

  it("normalizes password sign-in and restores a one-use intended destination", async () => {
    const fixture = createAuthFixture();
    const intendedDestinationStore = createIntendedDestinationStore({ now: () => 1_000 });
    const controller = createAuthSessionController(fixture.auth, {
      now: () => 1_000_000,
      intendedDestinationStore,
    });
    expect(controller.rememberIntendedDestination("/plan/tasks/task-1")).toBe(true);

    await expect(controller.signInWithPassword(" Couple@Example.com ", "not-a-real-password"))
      .resolves.toBe("/plan/tasks/task-1");
    expect(fixture.calls).toContainEqual([
      "signIn",
      "Couple@Example.com",
      "not-a-real-password",
    ]);
    expect(controller.getSnapshot().status).toBe("authenticated");
    await expect(controller.signInWithPassword("couple@example.com", "not-a-real-password"))
      .resolves.toBeNull();
  });

  it("rejects malformed credentials before calling Supabase Auth", async () => {
    const fixture = createAuthFixture();
    const controller = createAuthSessionController(fixture.auth);

    await expect(controller.signInWithPassword("not-an-email", "password"))
      .rejects.toEqual(expect.objectContaining({ failure: "invalid_credentials" }));
    expect(fixture.calls.some((call) => Array.isArray(call) && call[0] === "signIn")).toBe(false);
  });

  it("never exchanges a hostile callback", async () => {
    const fixture = createAuthFixture();
    const controller = createAuthSessionController(fixture.auth);

    await expect(controller.completeCallback(
      "https://www.everaft.co.uk.evil.test/auth/callback?code=stolen",
    )).rejects.toEqual(expect.objectContaining({ failure: "invalid_callback" }));
    expect(fixture.calls).not.toContainEqual(["exchange", "stolen"]);
  });

  it.each([
    ["signOutFromDevice", "local"],
    ["signOutEverywhere", "global"],
  ] as const)("withdraws the token before %s completes", async (method, scope) => {
    const fixture = createAuthFixture(activeSession());
    const controller = createAuthSessionController(fixture.auth, { now: () => 1_000_000 });
    await controller.start();

    const pending = controller[method]();
    await expect(controller.getAccessToken()).resolves.toBeNull();
    expect(controller.getSnapshot().status).toBe("signed_out");
    expect(fixture.calls).toContainEqual(["signOut", scope]);
    fixture.finishSignOut();
    await pending;
  });

  it("keeps local state signed out when remote revocation fails", async () => {
    const fixture = createAuthFixture(activeSession());
    const controller = createAuthSessionController(fixture.auth, { now: () => 1_000_000 });
    await controller.start();

    const pending = controller.signOutEverywhere();
    fixture.finishSignOut(new Error("offline"));
    await expect(pending).rejects.toBeInstanceOf(AuthSessionError);
    await expect(controller.getAccessToken()).resolves.toBeNull();
  });

  it("deletes local encryption material before remote sign-out settles", async () => {
    const fixture = createAuthFixture(activeSession());
    const clearLocalSecrets = jest.fn(async () => undefined);
    const controller = createAuthSessionController(fixture.auth, {
      now: () => 1_000_000,
      clearLocalSecrets,
    });
    await controller.start();

    const pending = controller.signOutFromDevice();
    await Promise.resolve();
    expect(clearLocalSecrets).toHaveBeenCalledTimes(1);
    await expect(controller.getAccessToken()).resolves.toBeNull();
    fixture.finishSignOut();
    await pending;
  });

  it("still requests remote revocation when local secret deletion fails", async () => {
    const fixture = createAuthFixture(activeSession());
    const controller = createAuthSessionController(fixture.auth, {
      now: () => 1_000_000,
      clearLocalSecrets: async () => { throw new Error("storage unavailable"); },
    });
    await controller.start();

    const pending = controller.signOutEverywhere();
    await Promise.resolve();
    expect(fixture.calls).toContainEqual(["signOut", "global"]);
    fixture.finishSignOut();
    await expect(pending).rejects.toEqual(
      expect.objectContaining({ failure: "sign_out_failed" }),
    );
  });
});
