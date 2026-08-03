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

Remote history contains 25 entries. Twenty-two migration names match repository
work, but fourteen of those were recorded remotely under different timestamps.
Remote history also contains the three legacy pricing phases, while the
repository retains those as non-timestamped phase files.

Seven timestamped repository migrations are genuinely pending:

1. `20260726140200_planning_workspace_foundation.sql`
2. `20260726162254_planning_workspace_snapshot_import.sql`
3. `20260726164304_planning_workspace_profiles.sql`
4. `20260726185032_planning_workspace_partner_budgets.sql`
5. `20260726191406_planning_table_plan_sync.sql`
6. `20260803122711_supplier_owner_update_requests.sql`
7. `20260803130045_supplier_catalogue_staging.sql`

Do not run an unreviewed bulk migration command against production. Timestamp
drift could cause already-applied logical migrations to be treated as new. The
activation runbook must either reconcile history first or apply only the seven
confirmed pending migrations by reviewed name, followed by the grant-hardening
migration below.

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
3. Re-read remote migration history and stop if it differs from this record.
4. Resolve timestamp history without replaying the 22 logically applied
   migrations.
5. Apply and verify the seven confirmed pending migrations in dependency order.
6. Apply `20260803143000_tighten_data_api_table_grants.sql`.
7. Re-run database security and performance advisors.
8. Exercise owner, partner, outsider and anonymous Data API tests. Stop on any
   unexpected read, write, function execution or table privilege.
9. Deploy the beta with cloud sharing still disabled and smoke-test the public
   planners plus the local-device Planning Hub journey.
10. Enable cloud sharing only under a separate approval after the preceding
    checks pass.

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
