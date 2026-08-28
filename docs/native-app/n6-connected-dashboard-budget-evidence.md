# N6 connected dashboard and budget evidence

Date: 28 August 2026

Branch: `codex/native-app-n6-connected-dashboard-budget`

Base: `df25ca7` (`Build native venue discovery vertical slice (#73)`)

## Status and safety boundary

N6 remains local-only. No branch was pushed, no pull request or hosted preview
was created, no migration was applied, and no production data, Vercel flag,
supplier data or outreach setting was changed.

The database work is isolated in local commit `3aa8b71`. The connected API and
native foundation is checkpointed in local commit `61099c3`; the final native
write/reconciliation work is the follow-up checkpoint recorded with this file.

## Connected product proof

- A signed-in client lists only RLS-visible workspaces and connects only the
  workspace whose `budgetPlanId` exactly matches the device plan.
- A device-only plan is never imported implicitly. Import requires the explicit
  **Connect this plan** action and uses the bounded, versioned atomic-import
  contract.
- Dashboard, full budget and profile resources hydrate in parallel behind the
  runtime API capability and bearer-token checks.
- Connected state is scoped to the authenticated account and is cleared on
  sign-out or account change. A missing workspace, disabled capability or
  network failure retains honest device-only operation.
- Venue estimates, quotes, bookings and manual venues save to the encrypted
  device repository first for immediate response. When connected, the client
  then sends the complete plan with the server-issued budget version, shows an
  explicit saving state and rehydrates the canonical workspace after success.
- A conflict, offline response or unavailable service never claims cloud
  success. The device change remains available, the UI reports that sync needs
  attention, and **Refresh connected plan** performs canonical ambiguous-write
  recovery.
- Today and Plan use the connected budget/profile when connected. Plan cards
  expose cost, estimate/quote/booking status, paid amount or next due date, and
  date-aware availability without inventing availability.

## API and database boundary

- Added strict versioned contracts for full-budget GET, connected resource,
  device-plan import and atomic setup update.
- Added bearer-authenticated full-budget GET, workspace-import POST and setup
  PATCH routes. They retain non-enumerating `404` behaviour and explicit
  `400/409/413/503` handling.
- The setup route calls only the additive `SECURITY INVOKER` function prepared
  by `20260826144100_n6_transactional_workspace_setup.sql`; it does not recreate
  or replay the 40 already-applied production migrations.
- The local verifier confirms exactly 40 production-aligned versions plus this
  one reviewed pending candidate. The candidate has not been linked, dry-run or
  applied remotely in this work.

## Verification

### Web, packages and contracts

- `npm.cmd run test:unit:web -- --pool=forks --no-file-parallelism` — 128 files,
  579 tests passed.
- `npm.cmd run test:packages` — 5 files, 18 tests passed across planning-domain,
  planning-contracts and api-client.
- `npm.cmd run planning-contract:check` — all 19 generated Draft 2020-12
  contracts current.
- `npm.cmd run typecheck` — web, all shared packages and mobile passed.
- `npm.cmd run lint` — zero errors; one pre-existing `no-img-element` warning in
  the venue Open Graph image remains unchanged.
- `npm.cmd run build` — optimized Next.js production build passed, including 92
  generated static pages and the new budget, import and setup routes.

### Native

- `npm.cmd run test:mobile` — 27 suites and 110 tests passed.
- Connected-provider tests cover matching-workspace hydration, account clearing,
  explicit import, device-first connected budget updates, server-version use,
  conflict fallback and ambiguous-write refresh recovery.
- Venue interaction tests cover connected/manual saves, distinct estimate,
  quote and booking states, payment/availability presentation and the manual
  catalogue fallback.

### Android emulator smoke

The free local `everaft_n3_android` emulator was booted as Android 16 at
1080x1920. From a temporary short physical worktree, the x86_64 command
`npx.cmd expo run:android --variant debug` completed successfully in 18m 48s
with 338 Gradle tasks. It produced an 80,045,784-byte debug APK, installed
`uk.co.everaft.mobile`, launched `.MainActivity`, bundled 1,731 modules and
rendered the Today screen with the truthful **On this device** status. The app
process was alive and the recent Android/React Native log scan contained no
fatal exception.

This smoke test proves local build, install, launch and device-only fallback. It
does not prove real connected authentication or production data writes because
no approved non-production credentials/workspace were configured in this
worktree.

### Security and migration gates

The following local executable verifiers passed on the final source:

- Planning Workspace RLS: owner/partner/outsider isolation, anonymous denial,
  atomic setup/import and conflict behaviour.
- Supplier owner and imagery RLS.
- Supplier claim review and profile-role escalation denial.
- Data API grants across 19 public tables.
- Supplier outreach migration compatibility.
- Production migration alignment: 40 canonical applied versions and one
  reviewed pending N6 candidate.

## Remaining release gates

1. Push the migration and code branches as separate draft pull requests only
   after explicit approval.
2. Re-run the linked read-only migration list and exact one-file dry run before
   any migration application; a second pending file is a hard stop.
3. Configure an approved non-production account/workspace and run the real
   Android Auth/Data API owner/partner/conflict harness. This is the remaining
   proof gate for connected operation.
4. Apply the exact N6 setup migration only under a separate explicit approval.
5. Merge/deploy the API code and enable any runtime capability only under their
   own explicit approvals. Native store distribution and physical-device QA are
   later release gates, not implied by this emulator result.
