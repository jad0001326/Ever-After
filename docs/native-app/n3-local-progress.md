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

No Supabase credentials or environment values are present. Tests use fixtures
only and make no hosted request. An Android emulator smoke test verified that
the no-environment build reaches Today, reports device-only storage on You,
shows no credential fields on the unavailable sign-in route and returns safely
to Today.

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

## Deliberately not claimed complete

- No real environment values or test credentials have been supplied, so the
  connected sign-in and hosted API journey has deliberately not run.
- Physical iOS and Android storage, reinstall, backup/restore and callback
  journeys remain mandatory before connected beta.
- Universal/App Link association is only declared in the native app locally.
  The website AASA and `assetlinks.json` files, Apple team identity, Android
  signing fingerprint and Supabase redirect allow-list have not been created or
  changed and remain controlled release gates.
- Authentication alone never claims cloud backup, partner sharing or a loaded
  Planning workspace. Authenticated workspace loading remains a later verified
  slice.
