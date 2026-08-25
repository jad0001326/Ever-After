# N4 device-first plan evidence

Date: 25 August 2026

N4 makes the native shell useful without claiming that a local plan is stored
in My EverAft cloud storage.

## Implemented boundary

- Three-step onboarding records exact date, season/year or unknown timing,
  Scottish location, guest count, working budget and up to five priorities.
- A versioned SQLite repository stores one local plan with optimistic revision
  checks, a payload checksum and a one-megabyte ceiling.
- A random installation secret remains in SecureStore. SQLite keeps only its
  digest, so a restored database without the device-bound secret fails closed
  instead of silently reopening private planning data.
- Android application backup is disabled for this internal prototype. The
  existing SecureStore backup exclusion remains enabled.
- Corrupt or mismatched state is deleted and replaced by a redacted recovery
  event; the unreadable private payload is not retained.
- Today is derived from the reopened plan through the shared planning-domain
  snapshot and calculation rules. Its storage label is `Saved on this device`
  or `Saving`; it does not claim cloud backup or partner sharing.
- A deep-linked development recovery screen can export/import a validated,
  bounded fixture locally. It performs no upload and is not linked from normal
  navigation.

## Required verification

- Mobile repository tests: create/reopen, revisioned offline edit, legacy
  schema migration, corrupt-cache recovery, restored-without-secret denial,
  recovery-fixture round trip and shared calculation parity.
- Existing native auth/session tests, package tests and web regression gates.
- Android emulator: create a plan, see the real Today totals and storage label,
  force-stop/relaunch, confirm the same plan returns, then repeat without a
  network connection.

No production API, Supabase migration, feature flag, supplier data, outreach,
paid service or hosted mobile build is part of N4.

## Verification completed

- Expo's dependency compatibility check passed with SDK 57.0.16,
  Reanimated 4.5.1 and Worklets 0.10.1.
- A no-cost local Android debug APK compiled successfully for the emulator,
  installed on Android 16 and loaded the real Expo Router application.
- Emulator onboarding created a £25,000 device plan with venue and photography
  priorities. Today reopened from SQLite with `On this device`, £25,000 total,
  £25,000 remaining and `Choose a venue` as the next action.
- The emulator confirmed `everaft-device-plan.db` plus its WAL files under the
  application's private files directory; the installation secret remained in
  SecureStore.
- A full process stop and second cold launch reopened the same Today plan. One
  earlier launch hit a transient React Native Fabric crash inside the resource-
  constrained emulator; the immediate repeat remained alive and rendered the
  persisted plan.
- With Wi-Fi and mobile data disabled after the debug bundle had loaded, Today
  remained alive and rendered the local plan; connectivity was then restored.
  A debug APK still needs Metro to cold-load application code, so cold offline
  persistence is covered by the repository reopen test rather than claimed as
  a release-build device proof.
- During the first device create, the smoke test found that WAL mode was being
  changed inside a SQLite transaction. The setup pragma now runs before the
  schema transaction, and the same emulator flow then saved successfully.
