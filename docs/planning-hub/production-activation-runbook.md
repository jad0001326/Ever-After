# Planning Hub production activation runbook

Date: 3 August 2026; updated 30 August 2026

Status: all 41 reviewed migrations, including atomic import, owner bootstrap,
conflict normalization, atomic supplier-claim review and the N6 transactional
workspace setup function, are applied. A 30 August Supabase CLI ledger refresh
confirmed exact 41/41 alignment and zero pending migrations. The N6 function's
live security metadata and rolled-back role checks also passed. The 22 August controlled
production Auth/Data API test passed its owner/partner/outsider/anonymous,
rollback and stale-write assertions; all three temporary Auth users were
deleted and the post-test planning ledger exactly matched its baseline.
This read-only refresh did not repeat a production supplier-claim mutation or
create test users. This document is not approval to reapply a migration, merge
or deploy application code, create production test users, change supplier
data, alter flags or contact suppliers.

## Release invariants

- Project identity must be `Ever-After` / `fryfdniacyhpubfiqnxj`.
- Production migration history and line-ending-canonical local source hashes
  must match the checked 41-entry manifest in
  `production-migration-history-2026-08-30.json`.
- The normal dry run must report that the remote database is up to date. Any
  local-only or remote-only migration is a stop condition.
- Never use `--include-all`, `--include-seed`, `--include-roles`, history repair
  or an unreviewed push.
- Never run `db reset --linked`, `migration repair`, `db pull` or direct
  Dashboard SQL as part of this release.
- Preserve the current environment-scoped values of
  `PLANNING_WORKSPACE_CLOUD_ENABLED`, `PLANNING_HUB_PUBLIC_ENTRY_ENABLED`,
  `SUPPLIER_CATEGORY_OUTREACH_ENABLED` and `SUPPLIER_ADMIN_SCHEMA_ENABLED`
  exactly; this ledger refresh authorises no flag change. Preserve the
  Production value of
  `OUTREACH_SENDING_ENABLED=true` so the existing venue and photographer
  outreach workflow remains operational; do not add it to Preview or broaden
  it to generic supplier categories.
- Stop on any identity, history, dry-run, backup, migration, advisor, RLS or
  application-smoke mismatch.

## 1. Prepare the release checkout

Use the reviewed, clean merge commit. Record the commit SHA and require:

```powershell
git status --short
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:production-migration-alignment
```

The only permitted local changes during preparation must be explicitly
reviewed. The alignment verifier must report all 41 applied migrations with
matching line-ending-canonical source hashes and zero pending migrations.
Canonicalization treats CRLF and LF as equivalent but preserves every other
SQL byte and final-newline state.

The workstation does not currently have the Supabase CLI on `PATH`. At release
time, use a reviewed stable CLI version and record it in the release log. CLI
`2.101.0` is the currently checked stable reference; re-check the official
release page before substituting a newer version.

## 2. Link and inspect without changing production

Authenticate interactively and link only to the expected project:

```powershell
npx.cmd --yes supabase@2.101.0 login
npx.cmd --yes supabase@2.101.0 link --project-ref fryfdniacyhpubfiqnxj
npx.cmd --yes supabase@2.101.0 migration list --linked
npx.cmd --yes supabase@2.101.0 db push --linked --dry-run
```

Save the outputs in the release record. Stop if the history is not the exact
41-entry manifest or the dry run proposes any migration. A dry run is
inspection only; it is not migration approval.

## 3. Verified no-cost checkpoint

The pre-migration checkpoint was created on 20 August 2026 after the Free-plan
project reported no hosted backup. It is encrypted with AES-256-GCM, its key is
protected by Windows DPAPI for the current user, and a full decrypt-and-hash
restore test passed. It is stored outside the repository and OneDrive at:

`%LOCALAPPDATA%\EverAft Recovery Checkpoints\pre-planning-migrations-20260820-173126`

## 4. Completed schema activation boundary

The user explicitly approved the checkpoint and exact ten-file apply. CLI
2.101.0 applied those files in ascending timestamp order and returned success.
The immediate follow-up ledger was 36/36 and its completion-time dry run was up
to date. The separately approved atomic-import migration
`20260820164604_atomic_planning_workspace_import.sql` was then applied; its
follow-up ledger was 37/37 and the dry run was up to date. Do not re-run or
repair either activation. The separately approved owner-bootstrap migration
`20260820184000_allow_planning_owner_bootstrap_read.sql` was then applied; its
follow-up ledger was 38/38 and its dry run was up to date. The separately
approved conflict-normalization migration
`20260820184100_normalize_planning_version_conflicts.sql` was applied on 22
August; its follow-up ledger was 39/39 and the dry run reported that production
was up to date. Those approvals did not authorise cloud persistence,
supplier activation or outreach changes.

## 5. Completed supplier-claim safety migration

`20260822141612_atomic_supplier_claim_review.sql` is applied. It
atomically validates claimant identity and supplier eligibility, serializes
competing reviews with supplier-first locks, creates the vendor membership,
synchronizes outreach state and writes an audit record. It also removes direct
browser-role review/audit mutations and prevents profile-role escalation.

The 25 August read-only ledger proves the migration identity is present after
the 39 earlier versions. Do not replay, repair or reapply it. The embedded
`test:supplier-claim-review` and native two-session
`test:supplier-claim-concurrency` gates remain required for application
changes. A new production mutation test, supplier flag change, supplier-data
change or outreach action remains a separate explicit approval.

## 6. Completed database verification

The 20 August schema checks and 30 August N6 post-apply verification established:

1. all 41 applied local versions match the remote ledger;
2. all 51 public tables have RLS enabled;
3. all 13 newly activated tables exist with their expected policy counts;
4. `anon` and `authenticated` have zero `TRUNCATE`, `TRIGGER` or `REFERENCES`
   privileges on public tables;
5. the 39 outreach campaigns and 1,060 recipients were unchanged;
6. the private submission and public supplier-image buckets exist with the
   expected limits, MIME types and six object policies;
7. `authenticated` has no table- or column-level `UPDATE` privilege on
   `public.profiles`, and no self-update policy exists;
8. the two advisor warnings for authenticated `SECURITY DEFINER` planning RPCs
   are intentional: both have an empty `search_path`, authenticated-only ACLs
   and explicit identity/ownership validation covered by the RLS verifier;
9. the remaining leaked-password warning and performance notices were not
   changed because they are outside this no-cost schema activation.

The embedded owner/partner/outsider and supplier-owner tests prove the SQL
contract locally. A real Auth/Data API test creates temporary users and rows,
so production execution requires a separate explicit test-data approval and
must verify cleanup. Cloud sharing cannot be enabled until that boundary has
been exercised against an approved environment.

## 7. Connected-cloud activation sequence

Database verification, atomic import, owner bootstrap and non-transient
conflict mapping are green. PR #70 was merged and its connected Planning
Workspace activation was separately approved after a controlled production
smoke proved user creation, sign-in, checked route contracts, owner/partner
access, outsider isolation, invitation binding, atomic import/rollback and
prompt stale-write conflicts. Cleanup deleted all three temporary Auth users;
profiles remained 6, budgets remained 3 and all connected planning tables
returned to zero rows. Preserve the currently configured Production/Preview
scopes exactly during future supplier releases. Keep generic-supplier flags
and the existing Production-only outreach-sending scope unchanged. Verify:

- the public home, venue catalogue, Budget Planner and Table Planner;
- signed-out users retain the local-device journey and cannot call connected
  APIs;
- one controlled signed-in owner can explicitly review and create a cloud copy;
- owner reload restores the same budget, profile, tasks, guests and table plan;
- partner invitation remains disabled until a controlled owner/partner smoke is
  separately approved or safely available;
- `/planning-hub` remains `noindex` until public-launch approval;
- no new warning, error or fatal runtime logs appear during the smoke window.

The public-entry switch is already Production-only and must remain unchanged.
Generic supplier drafting and email sending remain separate approvals and
separate switches.

## Rollback and stop rules

Application rollback means redeploying the prior application commit and
keeping the flags off. The migrations are additive and should remain in place
while a defect is investigated. Do not drop tables or rewrite migration
history. Do not reverse the grant hardening unless an exact role/table/privilege
regression is proven and separately approved.

For the atomic-import candidate, keep the cloud flag off while applying and
verifying the function. Deploy application code that calls it only after the
function exists. If either stage fails, keep the flag off and redeploy the
previous application commit; the unused additive function may remain until a
separately reviewed forward correction. Never remove the function while any
deployed application can call it.

Official references:

- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase CLI `db push` and `--dry-run`](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI releases](https://github.com/supabase/cli/releases)
