import { parseAuthCallback } from "./auth-callback";

export type AuthSession = Readonly<{
  access_token: string;
  expires_at?: number;
  user: Readonly<{ id: string }>;
}>;

export type AuthEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | string;

export type AuthClientBoundary = Readonly<{
  getSession(): Promise<{
    data: { session: AuthSession | null };
    error: Error | null;
  }>;
  exchangeCodeForSession(code: string): Promise<{
    data: { session: AuthSession | null };
    error: Error | null;
  }>;
  signOut(options: { scope: "local" | "global" }): Promise<{
    error: Error | null;
  }>;
  onAuthStateChange(
    listener: (event: AuthEvent, session: AuthSession | null) => void,
  ): { data: { subscription: { unsubscribe(): void } } };
}>;

export type AuthSessionStatus =
  | "idle"
  | "restoring"
  | "authenticated"
  | "signed_out"
  | "unavailable";

export type AuthSessionSnapshot = Readonly<{
  status: AuthSessionStatus;
  accountId: string | null;
  reason: "expired" | "restore_failed" | null;
}>;

export class AuthSessionError extends Error {
  readonly failure:
    | "invalid_callback"
    | "exchange_failed"
    | "restore_failed"
    | "sign_out_failed";

  constructor(failure: AuthSessionError["failure"]) {
    super(failure);
    this.name = "AuthSessionError";
    this.failure = failure;
  }
}

export function createAuthSessionController(
  auth: AuthClientBoundary,
  options: Readonly<{
    now?: () => number;
    clearLocalSecrets?: () => Promise<void>;
  }> = {},
) {
  const now = options.now ?? Date.now;
  let accessToken: string | null = null;
  let snapshot: AuthSessionSnapshot = {
    status: "idle",
    accountId: null,
    reason: null,
  };
  let subscription: { unsubscribe(): void } | null = null;
  let lifecycleRevision = 0;
  let authEventRevision = 0;
  const listeners = new Set<(next: AuthSessionSnapshot) => void>();

  function publish(next: AuthSessionSnapshot) {
    snapshot = Object.freeze(next);
    listeners.forEach((listener) => listener(snapshot));
  }

  function applySession(session: AuthSession | null, expiredReason = true) {
    if (!session || !isUsableSession(session, now())) {
      accessToken = null;
      publish({
        status: "signed_out",
        accountId: null,
        reason: session && expiredReason ? "expired" : null,
      });
      return;
    }
    accessToken = session.access_token;
    publish({
      status: "authenticated",
      accountId: session.user.id,
      reason: null,
    });
  }

  async function start() {
    if (subscription) return snapshot;
    const currentLifecycle = ++lifecycleRevision;
    publish({ status: "restoring", accountId: null, reason: null });
    subscription = auth.onAuthStateChange((_event, session) => {
      authEventRevision += 1;
      applySession(session);
    }).data.subscription;
    const eventRevisionBeforeRestore = authEventRevision;

    const { data, error } = await auth.getSession();
    if (currentLifecycle !== lifecycleRevision || !subscription) return snapshot;
    if (error) {
      accessToken = null;
      publish({ status: "unavailable", accountId: null, reason: "restore_failed" });
      throw new AuthSessionError("restore_failed");
    }
    // An auth event received while restoration was in flight is newer than
    // the saved session result and must remain authoritative.
    if (authEventRevision === eventRevisionBeforeRestore) {
      applySession(data.session);
    }
    return snapshot;
  }

  function stop() {
    lifecycleRevision += 1;
    subscription?.unsubscribe();
    subscription = null;
    accessToken = null;
    publish({ status: "idle", accountId: null, reason: null });
  }

  async function completeCallback(rawUrl: string) {
    const callback = parseAuthCallback(rawUrl);
    if (!callback) throw new AuthSessionError("invalid_callback");

    const { data, error } = await auth.exchangeCodeForSession(callback.code);
    if (error || !data.session) {
      accessToken = null;
      publish({ status: "signed_out", accountId: null, reason: null });
      throw new AuthSessionError("exchange_failed");
    }
    applySession(data.session);
    return callback.nextPath;
  }

  async function signOut(scope: "local" | "global") {
    // Revoke client access before the network request can settle so API calls
    // cannot continue with a cached bearer token after the user signs out.
    accessToken = null;
    publish({ status: "signed_out", accountId: null, reason: null });
    let cleanupFailed = false;
    if (options.clearLocalSecrets) {
      try {
        await options.clearLocalSecrets();
      } catch {
        cleanupFailed = true;
      }
    }
    const { error } = await auth.signOut({ scope });
    if (cleanupFailed || error) throw new AuthSessionError("sign_out_failed");
  }

  return Object.freeze({
    start,
    stop,
    completeCallback,
    signOutFromDevice: () => signOut("local"),
    signOutEverywhere: () => signOut("global"),
    getSnapshot: () => snapshot,
    getAccessToken: async () => accessToken,
    subscribe(listener: (next: AuthSessionSnapshot) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

function isUsableSession(session: AuthSession, nowMs: number) {
  if (!session.access_token || !session.user.id) return false;
  return session.expires_at === undefined || session.expires_at * 1000 > nowMs;
}
