# Production database preflight

Date: 3 August 2026; updated 25 August 2026

Status: all 40 recorded production migrations and line-ending-canonical source
hashes are aligned, with zero pending migrations. This read-only refresh did
not apply anything or change production rows, flags, outreach or paid
resources.

## Confirmed production state

- Supabase project `Ever-After` (`fryfdniacyhpubfiqnxj`) is healthy in
  `eu-west-1` on PostgreSQL 17.6.
- Production's checked ledger contains 40 applied migrations through
  `20260822141612_atomic_supplier_claim_review`.
- The controlled Planning Workspace security test passed and cleaned up all
  temporary users and rows. This read-only ledger refresh does not repeat it.
- Supplier counts, publication state, claim state and imagery were not changed
  or inferred during this merge refresh.

## Migration-history gate

Remote history contains 40 entries whose identities and line-ending-canonical
local source hashes match `production-migration-history-2026-08-25.json`. The
alignment verifier treats CRLF and LF as equivalent, while still failing if
any SQL content, final-newline state or applied identity is altered or if an
unexpected local migration is present.

The refreshed branch contains zero pending migrations. A normal reviewed dry
run must report that the remote database is up to date. `--include-all`,
migration history repair, seed data and custom roles are prohibited. Any
different result is a stop condition.

The supplier-claim migration-time lock, rewrite and existing-row surface was
reviewed before application in `pending-migration-risk-review-2026-08-03.md`.
The 25 August refresh confirms only its ledger identity; it does not claim a
new production mutation test.

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

The separate `20260813074826_lock_down_profile_role_updates.sql` hotfix revoked
all authenticated `UPDATE` access to `public.profiles` and removed the unsafe
row-only self-update policy. Post-apply verification confirmed no remaining
table or column update grant, no unsafe policy, and an unchanged fingerprint
across all six profile rows.

Supabase's current platform direction also makes explicit grants important:
new tables are no longer automatically exposed through the Data and GraphQL
APIs, while RLS remains a separate control. The applied Planning Hub and
supplier migrations revoke defaults and then grant only their required
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

## Exact no-cost alignment sequence

Historical note: the earlier Planning Workspace activation is complete and
must not be repeated. The supplier-claim migration is also applied and must not
be replayed:

1. Preserve all environment-scoped flag values.
2. Confirm the existing recoverable production checkpoint remains available.
3. Re-read remote history and stop unless all 40 applied identities match the
   captured manifest and line-ending-canonical source hashes.
4. Run `npm run test:production-migration-alignment`; require exactly 40
   applied migrations and zero pending migrations.
5. Run the normal dry run without `--include-all`; require an up-to-date result.
6. Do not run a live `db push`, history repair or migration apply.
7. Keep the claim-review verifier and native two-session concurrency gate green
   for related application changes.
8. Keep supplier data, category flags and outreach unchanged throughout.

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
