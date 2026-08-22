# N3 local progress

Status: completed credential-free auth/API and encrypted-session foundations on
`codex/native-app-n3`; committed locally in separate checkpoints and not
pushed.

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

No Supabase credentials or environment values are present. Tests use fixtures
only and make no hosted request.

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

- The encrypted production adapter is implemented and verified on an Android
  emulator, but is not yet wired into sign-in/callback screens or supplied with
  real environment values.
- Physical iOS and Android storage, reinstall, backup/restore and callback
  journeys remain mandatory before connected beta.
