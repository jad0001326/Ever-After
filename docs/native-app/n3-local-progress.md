# N3 local progress

Status: completed credential-free auth/API and encrypted-session foundations on
`codex/native-app-n3`. The checkpoints are pushed in draft PR #71. The third
checkpoint adds the environment-safe auth runtime, screens and native
callback-link declarations described below.

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
  withdrawal before local or global sign-out completes;
- an AES-256-GCM session envelope in AsyncStorage with its small encryption key
  held separately in Expo SecureStore using
  `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` and no biometric prompt;
- versioned authenticated envelopes, serialized writes, interrupted-write
  recovery, account namespaces, a 64 KiB plaintext ceiling and fail-closed
  recovery for missing keys, malformed envelopes and failed authentication;
- an installation marker that clears Keychain material surviving an iOS
  reinstall, while Android backup restore without its uninstall-bound key also
  fails closed;
- explicit sign-out cleanup that destroys local encrypted session material
  before remote session revocation, while still attempting revocation if local
  cleanup reports a failure; and
- Android backup configuration through the Expo SecureStore config plugin.

## Environment-safe auth runtime and screens

- a fail-closed native environment boundary that accepts only the public
  Supabase URL and publishable key and never starts a hosted client for absent,
  partial or unsafe configuration;
- one app-wide auth runtime with a single session-restore path and foreground
  refresh listener;
- an accessible credential sign-in screen that preserves password bytes,
  clears the password after every attempt and never exposes provider errors;
- strict one-attempt PKCE callback handling with safe one-use return paths and
  removal of the callback URL from native linking state;
- a startup privacy cover while a configured session is being restored;
- a truthful device-only account screen that keeps account authentication
  separate from successful cloud-workspace loading; and
- native-side iOS Universal Link and Android App Link declarations for
  `https://www.everaft.co.uk/auth/callback`, while retaining the controlled
  `myeveraft` development scheme.

No Supabase credentials or environment values are committed. Automated tests
use fixtures only and make no hosted request. An Android emulator smoke test
verified that the no-environment build reaches Today, reports device-only
storage on You, shows no credential fields on the unavailable sign-in route
and returns safely to Today.

## Local Android encryption evidence — 22 August 2026

The development-only `/session-storage` diagnostic passed in Expo Go 57.0.9 on
an Android 16 emulator. It verified native AES encryption/decryption, exported
key re-import, envelope reconstruction, a 16 KiB Supabase-style session,
ciphertext without plaintext tokens, cold restore, refresh rotation,
committed-envelope recovery, tamper failure and reinstall-marker recovery.

Expo Crypto's Android bridge requires a base64 envelope to be decoded to bytes
before `AESSealedData.fromCombined`; the adapter covers that boundary with a
strict decoder and test vectors. This is emulator evidence only and does not
replace the physical-device release gate.

## Connected local Android auth evidence — 22 August 2026

A second Android 16 emulator run used a disposable, unlinked local Supabase
stack only. The local stack ran Auth v2.188.1 behind the local gateway and a
fresh database created from the repository schema plus all 39 timestamped
migrations. The disposable baseline needed the existing Phase 10 enrichment
block moved before the manual-contact block to satisfy their dependency order;
that mechanical repair exists only in the temporary local stack and did not
change the repository or any hosted database.

The connected run verified that:

- a local-only password account can sign in through the real Supabase client
  from Expo Go on Android;
- the authenticated account state reaches Today while the account screen still
  truthfully reports `On this device` until a cloud workspace is loaded;
- the persisted AsyncStorage record contains the versioned AES-256-GCM
  envelope markers and contains neither the account email nor a plaintext
  `access_token` session shape;
- force-stopping Expo Go and reopening the app restores the authenticated
  session without re-entering credentials; and
- delaying foreground auto-refresh binding until initial session restoration
  completes removes the first-start Supabase process-lock contention warning.

The local URL and publishable key live only in ignored
`apps/mobile/.env.local`. No password, token, secret key or environment value
is committed. The temporary project is not linked to production and the run
made no hosted, production, deployment, flag, supplier-data or outreach
change.

## Deliberately not claimed complete

- Real Android password sign-in and encrypted cold restoration are verified
  against the disposable local stack. A separately controlled hosted test
  environment and connected Planning API journey have not run.
- Physical iOS and Android storage, reinstall, backup/restore and callback
  journeys remain mandatory before connected beta.
- Universal/App Link association is only declared in the native app locally.
  The website AASA and `assetlinks.json` files, Apple team identity, Android
  signing fingerprint and Supabase redirect allow-list have not been created or
  changed and remain controlled release gates.
- Authentication alone never claims cloud backup, partner sharing or a loaded
  Planning workspace. Authenticated workspace loading remains a later verified
  slice.
