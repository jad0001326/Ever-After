# N9B draft pull request

Proposed title: `N9B: Add native guest management and conflict recovery`

Base dependency: draft PR #80 (`codex/native-app-n9-guests-tables`). The N9B
delta must be transplanted onto PR #80 head `ec3139f` before it is committed.

## Summary

- Add native guest add, bulk entry, search, edit, RSVP and deletion flows using
  the existing device-first planning provider.
- Persist account-scoped offline retry journals for budget, table-plan and task
  writes without duplicating private guest content.
- Persist a minimal last-connected account/workspace/version checkpoint so a
  cold-start offline edit can be journaled without storing cloud ownership in
  the device-only plan identity.
- Replace ambiguous refresh behaviour with explicit **Use My EverAft copy** and
  **Keep this device copy** recovery choices.
- Guard pending saves and recovery against sign-out, account changes, newer
  refreshes and stale cloud versions.
- Rehydrate and durably persist the complete canonical connected-planning state
  before clearing recovery markers; retain markers when protected private-SQLite
  persistence fails.
- Use shared accessible action controls across guest, account and payment
  screens, with honest device/cloud and record-only payment language.

## User outcome

Couples can maintain their guest list on the native app and retain device work
through ordinary offline failures. When the cloud and device copies genuinely
conflict, the app explains both safe choices and does not silently overwrite one
copy or imply that Refresh resolved the decision.

## Safety and privacy boundaries

- No credentials, access tokens or service keys are added.
- Runtime diagnostics do not log guest names, contact details, dietary notes,
  budget contents or task text.
- Recovery is account, workspace, resource and revision scoped.
- Partner access is not activated or claimed as verified.
- Payments remain records only; this change does not transfer money.
- No migration, hosted write, feature flag or production data change is part of
  this pull request.

## Current local evidence

- Native milestone suite after review fixes: 40 suites, 190 tests passed.
- Package suites: 8 suites, 38 tests passed, including complete 101-task
  hydration across API pages.
- Focused guest, provider, codec and conflict-recovery checks: 49 tests passed.
- Focused connected-provider suite includes cold-start offline guest replay,
  canonical partner-task add/delete persistence, first-connect mutation
  blocking, mixed tasks, sign-out, cross-account and protected-write failure
  coverage.
- Payment and task copy regressions prove a refused first-connect mutation is
  never described as device-saved.
- Mobile TypeScript, full Expo lint and Git whitespace checks passed.
- Stable patch IDs prove original N9A commit `a986dde` and current PR #80 head
  `ec3139f` contain the same N9A change.
- A temporary-index dry run proved all tracked N9B edits apply cleanly to
  `ec3139f`; the then-nine new files had no collisions.

The real transplant and focused corrective checks are complete. Automated
evidence does not establish physical-device or real-account readiness.

## Reviewer focus

1. Account/workspace revision guards around every asynchronous save and recovery
   path.
2. Preservation of unaffected device-only discovery and manual planning data.
3. Mixed task create, update and delete behaviour when cloud state moves.
4. Marker clearing only after canonical confirmation and protected device persistence.
5. Accessible confirmation, disabled and busy states on guest, account and
   payment actions.
6. Customer-facing copy must distinguish device save, cloud sync and payment
   records without promising unavailable capabilities.

## Remaining release gates

- Real authentication and session restoration in the approved connected test
  environment.
- Account switching and two-client conflict recovery.
- Partner invitation, access boundary and removal lifecycle.
- Physical Android and iOS golden journeys, including restart and offline reopen.
- Separate approval before merging, deployment or native build distribution.

## Recovery

The change remains an isolated draft branch. Before merge, recovery is to close
the draft PR or replace its branch with a corrected commit. After a future merge,
use a normal revert of the isolated squash commit. No database rollback is
required because this slice contains no migration or hosted data change.
