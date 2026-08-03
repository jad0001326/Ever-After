# Production database preflight

Date: 3 August 2026

Status: read-only audit complete. No migration, production data change, branch,
paid resource or feature activation was created.

## Confirmed production state

- Supabase project `Ever-After` (`fryfdniacyhpubfiqnxj`) is healthy in
  `eu-west-1` on PostgreSQL 17.6.
- All 38 current `public` tables have row level security enabled.
- Production contains `budget_plans` and the photography supplier foundation.
  It does not contain the five Planning Workspace tables/migrations, supplier
  owner update requests or supplier catalogue staging introduced by this
  release candidate.
- The supplier baseline remains 16 categories, 31 supplier listings and no
  approved supplier images. This audit did not import or publish anything.

## Migration-history gate

Remote history contains 25 entries and was refreshed read-only after the
initial audit. The repository now uses those exact 25 production versions:
fourteen logically matching files were renamed to production's recorded
timestamps, and the three legacy pricing phases were copied into timestamped
migration files without changing their SQL. The captured manifest is
`production-migration-history-2026-08-03.json`; the alignment verifier fails if
an existing production identity is absent or the reviewed pending set changes.

Nine timestamped repository migrations are genuinely pending:

1. `20260726140200_planning_workspace_foundation.sql`
2. `20260726162254_planning_workspace_snapshot_import.sql`
3. `20260726164304_planning_workspace_profiles.sql`
4. `20260726185032_planning_workspace_partner_budgets.sql`
5. `20260726191406_planning_table_plan_sync.sql`
6. `20260803122711_supplier_owner_update_requests.sql`
7. `20260803130045_supplier_catalogue_staging.sql`
8. `20260803143000_tighten_data_api_table_grants.sql`
9. `20260803150000_generalize_supplier_outreach.sql`

Do not run an unreviewed bulk migration command against production. First
refresh the remote list and compare it with the captured manifest. If it is
unchanged, a normal reviewed migration push no longer needs `migration repair`:
the first 25 local identities match production exactly and only the nine files
above should be pending. If it differs, stop; do not repair history or push.

The migration-time lock, rewrite and existing-row surface is reviewed in
`pending-migration-risk-review-2026-08-03.md`. Read-only live counts and
constraint-shape queries found no incompatible existing outreach row.

## Access-control finding

Production RLS is enabled, but the Data API roles also hold `TRUNCATE`,
`TRIGGER` and `REFERENCES` on legacy public tables: 18 tables for `anon` and 19
for `authenticated`. RLS does not govern `TRUNCATE`, and browser-facing roles do
not need any of these three privileges.

`20260803143000_tighten_data_api_table_grants.sql` removes only those three
privileges from the affected 19 tables. It deliberately leaves existing
`SELECT`, `INSERT`, `UPDATE` and `DELETE` grants unchanged so application access
continues to be decided by the existing grants and RLS policies. A disposable
PostgreSQL verifier proves the narrow privilege change.

Supabase's current platform direction also makes explicit grants important:
new tables are no longer automatically exposed through the Data and GraphQL
APIs, while RLS remains a separate control. The pending Planning Hub and
supplier migrations already revoke defaults and then grant only their required
operations.

## Advisor findings

The security advisor reports one warning: leaked-password protection is
disabled. It also reports 17 informational `RLS enabled, no policy` notices.
Sixteen of those tables are intentionally service-only or private; their lack
of browser policies must be checked against their effective grants before
activation rather than resolved by adding permissive policies.

The performance advisor reports 122 notices:

- 18 unindexed foreign keys;
- 9 RLS policies that repeatedly initialise authentication functions;
- 1 table without a primary key;
- 39 currently unused indexes;
- 55 overlapping permissive policies.

These are not all release blockers. The Planning Workspace migrations already
use cached auth checks and dedicated indexes. Existing warnings should be
triaged separately and changed only with query evidence; indexes must not be
dropped merely because a low-traffic database currently labels them unused.

## Exact no-cost activation sequence

1. Review and merge the application pull request while leaving
   `PLANNING_WORKSPACE_CLOUD_ENABLED` absent.
2. Confirm a recoverable production database checkpoint.
3. Re-read remote migration history and stop if it differs from the captured
   25-entry manifest.
4. Run `npm run test:production-migration-alignment`; require exactly 25
   matching and nine pending migrations.
5. Use the runbook's reviewed `--include-all` command because
   `20260726140200_planning_workspace_foundation.sql` predates production's
   latest recorded migration. Review the proposed list; it must contain only
   the nine files recorded above, in order.
6. Apply those nine migrations under one explicit production approval. Do not
   include seed data.
7. Re-run database security and performance advisors.
8. Exercise owner, partner, outsider and anonymous Data API tests. Stop on any
   unexpected read, write, function execution or table privilege.
9. Deploy the beta with cloud sharing still disabled and smoke-test the public
   planners plus the local-device Planning Hub journey.
10. Enable cloud sharing only under a separate approval after the preceding
    checks pass.

`migration repair` is no longer part of the expected activation path. Supabase
documents that it changes only the remote migration-history table, not the
schema, so it remains a stop-and-reassess action requiring separate approval if
the refreshed history ever diverges.

## Rollback boundary

The immediate application rollback is to keep or restore
`PLANNING_WORKSPACE_CLOUD_ENABLED` as absent. Additive schema should remain in
place while defects are investigated. The grant-hardening migration should not
normally be reversed; any emergency re-grant must name the exact table, role
and privilege and requires separate security review. Destructive table removal
or migration-history rewriting is outside this release and requires a fresh
checkpoint and explicit approval.

References:

- [Supabase Data API grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Supabase database linter](https://supabase.com/docs/guides/database/database-linter)
- [Supabase leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
