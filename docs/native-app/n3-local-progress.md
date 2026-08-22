# N3 local progress

Status: completed local foundation on `codex/native-app-n3`; committed locally
and not pushed.

## Implemented fixture-only foundation

- schema-validated workspace-list and dashboard requests through the EverAft
  Planning API;
- bearer-token injection through a session callback, with no token values in
  diagnostics;
- explicit unauthenticated, offline, cloud-disabled, API-unavailable and
  invalid-contract failures;
- HTTPS-only remote origins, with HTTP allowed only for localhost development;
- an account-namespaced session-storage adapter and in-memory test backend;
- Supabase client construction with a publishable key, `processLock`, persisted
  sessions, automatic refresh and `detectSessionInUrl: false`;
- foreground-only refresh lifecycle with deterministic listener cleanup; and
- strict native/web auth callback parsing with hostile-host and unsafe-return
  path tests;
- cold session restoration that cannot overwrite a newer auth event or restore
  private state after teardown;
- token rotation and account-switch isolation without exposing tokens in the
  public session snapshot;
- PKCE code exchange through the strict callback boundary; and
- one-use, one-hour intended-destination restoration plus immediate bearer
  withdrawal before local or global sign-out completes.

No Supabase credentials or environment values are present. Tests use fixtures
only and make no hosted request.

## Deliberately not claimed complete

- The production session-storage implementation is not selected yet. The N3
  gate still requires either whole-session SecureStore evidence on physical
  devices or an authenticated-encrypted envelope with its key in SecureStore.
- The credential-free PKCE exchange, logout/revocation and intended-route
  primitives are implemented and tested, but are not yet wired into screens or
  a production session-storage adapter.
- Physical iOS and Android storage, reinstall, backup/restore and callback
  journeys remain mandatory before connected beta.
