# Planning Hub production activation runbook

Date: 3 August 2026; updated 13 August 2026

Status: prepared locally. This is not approval to push, merge, deploy, change
migration history, apply SQL, create test users or enable a feature flag.

## Release invariants

- Project identity must be `Ever-After` / `fryfdniacyhpubfiqnxj`.
- Production migration history must still match the checked 26-entry manifest.
- The dry run must list exactly the eleven migrations recorded in
  `production-preflight-2026-08-03.md`, in ascending order.
- Use `--include-all` because all eleven reviewed pending migrations are older
  than production's latest recorded migration. The exact manifest check and
  dry run below still
  limit the release to the eleven reviewed files. Never use `--include-seed` or
  `--include-roles`.
- Never run `db reset --linked`, `migration repair`, `db pull` or direct
  Dashboard SQL as part of this release.
- Keep `PLANNING_WORKSPACE_CLOUD_ENABLED`,
  `PLANNING_HUB_PUBLIC_ENTRY_ENABLED`,
  `SUPPLIER_CATEGORY_OUTREACH_ENABLED` and `SUPPLIER_ADMIN_SCHEMA_ENABLED`
  off. Preserve the currently approved Production value of
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

The status output must be empty. The alignment verifier must report 26 exact
production identities and eleven pending migrations.

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
npx.cmd --yes supabase@2.101.0 db push --linked --include-all --dry-run
```

Save the outputs in the release record. Stop if the history is not the exact
26-entry manifest or the dry run is not the exact eleven-file pending set. A dry
run is inspection only; it is not migration approval.

## 3. Create the no-cost checkpoint

Before any approved push, confirm the project's existing hosted backup status.
Also create encrypted, access-controlled local schema and public-data dumps.
Do not place them inside the repository, OneDrive or a shared folder, and do
not commit them.

```powershell
$everaftCheckpoint = New-Item -ItemType Directory -Path (Join-Path $env:TEMP ("everaft-prod-checkpoint-" + (Get-Date -Format "yyyyMMdd-HHmmss")))
npx.cmd --yes supabase@2.101.0 db dump --linked --file (Join-Path $everaftCheckpoint.FullName "schema.sql")
npx.cmd --yes supabase@2.101.0 db dump --linked --data-only --use-copy --file (Join-Path $everaftCheckpoint.FullName "public-data.sql")
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $everaftCheckpoint.FullName "schema.sql"), (Join-Path $everaftCheckpoint.FullName "public-data.sql")
```

The release log records only the checkpoint location, creation time and hashes,
never dump contents or credentials. If either dump fails, stop. Retain or
securely remove the checkpoint according to the agreed retention decision
after the release window.

## 4. Explicit production approval point

Present the commit SHA, CLI version, project identity, unchanged 26-entry
history, exact eleven-file dry run, checkpoint confirmation, passing local gates
and rollback boundary. Ask for approval to apply those eleven named migrations.

Only that approval authorises:

```powershell
npx.cmd --yes supabase@2.101.0 db push --linked --include-all
```

It does not authorise seed data, history repair, deployment, cloud persistence,
supplier activation or outreach sending.

## 5. Immediate database verification

After an approved push:

1. Re-run `migration list --linked`; it must show all 37 local versions on the
   remote side with no local-only or remote-only entry.
2. Re-run the Supabase security and performance advisors and retain the delta.
3. Confirm every new public table has RLS enabled and the expected explicit
   grants only.
4. Confirm `anon` and `authenticated` retain no `TRUNCATE`, `TRIGGER` or
   `REFERENCES` privilege on the 19 audited legacy tables.
5. Confirm the generic supplier outreach columns and constraints exist, while
   historical `photographer` campaign rows remain unchanged.
6. Confirm the supplier image submission table and both empty, restricted
   storage buckets exist with the expected RLS and object policies.
7. Confirm `authenticated` has no table- or column-level `UPDATE` privilege on
   `public.profiles`, especially `role`.
8. Before enabling supplier claims, run `npm.cmd run test:supplier-claim-review`
   and confirm the required `Supplier claim native concurrency` GitHub check is
   green. The latter uses independent native PostgreSQL sessions to review
   competing claims and race a late submission against approval. Confirm
   supplier-first locking serializes every action without a deadlock and leaves
   consistent claim, supplier, vendor membership, outreach and audit outcomes.
9. Stop and keep all dormant feature flags off on any mismatch.

The embedded owner/partner/outsider and supplier-owner tests prove the SQL
contract locally. A real Auth/Data API test creates temporary users and rows,
so production execution requires a separate explicit test-data approval and
must verify cleanup. Cloud sharing cannot be enabled until that boundary has
been exercised against an approved environment.

## 6. Application deployment sequence

With database verification green, deploy the application while the four
dormant Planning Hub and generic-supplier flags remain off and the existing
Production outreach-sending flag remains unchanged. Verify:

- the public home, venue catalogue, Budget Planner and Table Planner;
- signed-out Planning Hub local-device creation, venue selection, Photography
  handoff, budget update, Organise continuity and manual supplier entry;
- admin venue and Photography outreach drafting still loads, without creating
  or sending a campaign;
- generic supplier outreach is absent;
- `/planning-hub` remains `noindex` until public-launch approval;
- no new warning, error or fatal runtime logs appear during the smoke window.

Enabling `PLANNING_WORKSPACE_CLOUD_ENABLED=true` is a later approval after the
real Auth/Data API boundary passes. Exposing the homepage/header Planning Hub
entry via `PLANNING_HUB_PUBLIC_ENTRY_ENABLED=true`, generic supplier drafting
and email sending remain separate approvals and separate switches.

### Supplier-claim deployment dependency

Do not deploy the application commit that calls `review_supplier_claim` before
the eleven-migration activation and immediate verification above are complete.
That application intentionally relies on the new submission triggers and
review RPC: deploying it against today's schema would stop synchronising a new
claim to the supplier's pending state and would make admin approval/rejection
fail because the RPC does not yet exist. The safe order is database checkpoint,
approved migration push, privilege/concurrency verification, then application
deployment. If migration approval is deferred, keep the supplier-claim pull
request in draft and deploy public-beta messaging independently.

## Rollback and stop rules

Application rollback means redeploying the prior application commit and
keeping the flags off. The migrations are additive and should remain in place
while a defect is investigated. Do not drop tables or rewrite migration
history. Do not reverse the grant hardening unless an exact role/table/privilege
regression is proven and separately approved.

Official references:

- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase CLI `db push` and `--dry-run`](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI releases](https://github.com/supabase/cli/releases)
