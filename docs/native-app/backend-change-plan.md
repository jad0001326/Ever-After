# Native app backend change plan

Date: 26 August 2026

Status: N6 database boundary applied and verified under explicit approval. This
document does not authorise replaying SQL, production test data, a flag change,
an application deployment, outreach or a paid service.

## Verified live baseline

A production-ledger inspection and the approved N6 application confirmed 41
applied migrations through
`20260826144100_n6_transactional_workspace_setup`. The applied set now includes the
Planning Workspace foundation, profiles, member-linked budgets, atomic import,
owner bootstrap read and normalized conflict handling. The repository's
recorded source hashes match all 41 applied versions with no historical gap.

The N6 migration adds exactly one later function:
`20260826144100_n6_transactional_workspace_setup.sql`. It does not recreate,
replace or reapply the earlier live workspace schema. Production now contains
that reviewed function and has no pending repository migration.

## Principle: add only a real client blocker

No database work was needed for N0–N5's local shell, onboarding, device plan,
venue discovery, bookmarks or comparison. N6 reuses the now-live workspace
schema and needs only the additive transactional setup function described
below; all other N6 backend work is API, contract and native-client code.

Realtime, Edge Functions, a new Storage bucket, queues, cron, vector/search
extensions and push-token tables are not MVP prerequisites. They remain absent
until a measured client outcome requires them.

## API and database impact matrix

| Boundary | Current main | Database impact | Release slice |
| --- | --- | --- | --- |
| `GET /api/planning/v1/workspaces` | Exists, bearer-authenticated and cloud-gated | Uses live workspace/member RLS | N6 |
| `GET .../{id}/dashboard` | Exists, bearer-authenticated and cloud-gated | Uses live workspace/profile/task/table/budget links | N6 |
| `PATCH .../{id}/budget` | Exists, CAS-gated | Uses live linked-budget member RLS | N6 |
| `GET .../{id}/budget` | Missing | Contract and route only; no schema change | N6 |
| `GET/PATCH .../{id}/profile` | Exists, cloud-gated | Uses live workspace profile/member RLS | N6 |
| `PATCH .../{id}/setup` | Missing | Requires new transactional setup function | N6 |
| `GET/POST .../{id}/tasks` | Exists, cloud-gated | Uses live planning task table/RLS | N6/N8 |
| `GET .../{id}/tasks/{taskId}` | Missing | Code/contract only; no new table | N8 |
| `PATCH/DELETE .../{id}/tasks/{taskId}` | Exists, cloud-gated | Requires planning task table/RLS | N6/N8 |
| `GET/PATCH .../{id}/table-plan` | Exists, cloud-gated | Uses live guest/table/seat/rule tables and sync function | N6/N9 |
| `POST /api/planning/v1/workspaces/import` | Missing | Uses the live reviewed atomic import function | N6 |
| Venue list/detail APIs | Exists | Existing published catalogue tables; no new schema | N5 |
| Favourite list/mutations | Exists for venue targets | Existing `favourites`/`supplier_favourites` RLS; no new schema | N5/N7 |
| Partner sharing APIs | Missing | Requires hardened invitation/membership constraints/functions | N10 |
| Account export/deletion APIs | Missing | Data-inventory result determines minimal private job/receipt schema | N12 |

All native-facing Next routes remain behind product capability and bearer-auth
checks. Database/RPC unavailability is never turned into an empty plan or a
false cloud-save success.

## N6 schema package

The workspace core, profile, member-linked budget, bounded atomic import and
table-plan sync are already applied and verified. N6 adds no table, column,
extension, role, seed or supplier/outreach object.

### N6-DB1 — Transactional setup

Add one `SECURITY INVOKER`, empty-search-path function called only by the setup
API. It:

1. requires `auth.uid()` and validates bounded, versioned input;
2. locks the workspace first, then its linked budget and profile in a documented
   deterministic order;
3. verifies membership and exact workspace, budget and profile versions;
4. updates total budget plus the budget JSON compatibility mirrors for date,
   guest count and location;
5. inserts/updates the complete workspace profile as the connected source of
   truth; and
6. returns canonical data and all new versions only after one transaction
   succeeds.

Any validation, authorization or version failure changes nothing. Execute is
revoked from `PUBLIC`, `anon` and roles that do not require it, then granted
explicitly to `authenticated`. The implementation verifies actual function
privileges rather than assuming Supabase's evolving default exposure behavior.

The migration was created with the pinned Supabase CLI rather than by inventing
a timestamp. The existing table-plan sync remains unchanged and independently
verified.

## N10 sharing schema package

Sharing remains a separate migration and flag/client release. It adds:

- one hashed, seven-day, email-bound active invitation per workspace;
- a partial unique constraint/index allowing at most one `role='partner'`
  membership per workspace;
- owner-only create/revoke/remove boundaries;
- workspace-first serialization for invitation creation and acceptance;
- same-token/same-confirmed-account idempotent acceptance after a lost response;
- self-invite, second-partner, wrong-email, expired and enumeration denial; and
- protected owner membership that cannot be removed or demoted.

Use `SECURITY INVOKER` where RLS can express the operation. Any genuinely
required `SECURITY DEFINER` helper stays narrow, uses a verified caller and empty
search path, fully qualifies relations and has default execution revoked.

N10 includes real two-session concurrency tests. Sequential unit tests do not
prove workspace-first locking or unique-partner behavior.

## N12 account lifecycle schema decision

No account-deletion migration is designed until the full personal-data/foreign-
key/Storage inventory and retention policy are approved. The present schema has
both cascading and restrictive profile relationships, so deleting Auth first is
not a workflow.

If synchronous bounded export/deletion cannot meet retry and timeout budgets,
N12 may add a private job/receipt table. It is not exposed through the Data API,
stores no exported payload or raw token, has a minimal terminal receipt and an
approved expiry. Export artifacts, if any, are encrypted, caller-scoped and
short-lived. A queue/cron product is not added merely because the operation is
called a job.

## Allowlisted migration release path

The repository now matches all 41 production migrations, so the old temporary
release-workdir workaround is no longer needed. The completed N6 gate required:

1. fetch the live migration list and require exact 40/40 pre-apply equality;
2. verify the canonical source hash of every applied file;
3. require the only local pending file to be the named N6 setup candidate;
4. run the pinned CLI's current `db push --help` and a linked dry run;
5. require the dry run to list that one candidate exactly once; and
6. obtain exact approval, apply only that file, then require 41/41 equality and
   controlled rolled-back security checks.

Hard prohibitions:

- no `--include-all`, `--include-seed` or `--include-roles`;
- no dashboard copy/paste or raw SQL apply that bypasses migration history;
- no `migration repair` to mark unapplied SQL as applied;
- no unresolved glob or current-directory assumption;
- no supplier, catalogue, outreach, image, seed or unrelated SQL; and
- no remote apply in the same approval as writing/reviewing the migration.

The actual push command is deliberately absent. It is generated only after a
fresh CLI help check, manifest verification, reviewed dry-run and explicit
remote-application approval.

## Verification gates

### Before a migration PR is reviewable

- Fresh local stack applies the exact release workdir from the live baseline.
- Existing 15 planning contracts remain current; new endpoints add versioned
  contracts and negative fixtures.
- Schema/types are regenerated and diff-reviewed.
- Table grants, column grants, function execute privileges and RLS are asserted
  directly for `anon`, `authenticated`, `service_role` and `PUBLIC` as relevant.
- Owner, partner (where released), outsider, anonymous and malformed/expired
  bearer cases pass through both SQL and real Data API layers.
- Concurrent setup/import/sharing/table tests use real separate sessions.
- Payload limits, duplicate IDs, lost responses and transaction rollback pass.
- Database security/performance advisors are reviewed after DDL.

### Before any remote application

- Live migration list is re-read and equals the manifest exactly.
- Live table preflight still shows the target objects absent or in the exact
  expected predecessor state.
- Installed extension/version assumptions are re-read; no extension version is
  pinned in SQL because current Supabase ignores/deprecates that form.
- Dry run contains only the approved release migrations.
- Lock duration/query plans are reviewed against realistic local volumes.
- Forward-correction and emergency grant-revocation SQL are reviewed but not
  pre-applied.
- The user separately approves the named project, exact migrations and apply.

### After an approved remote application, with flags still off

- Re-read migration history, objects, RLS state, grants and function privileges.
- Run read-only schema/grant checks in production.
- Run mutating Auth/Data API harnesses only in an approved local/non-production
  environment unless production test-data creation receives separate approval.
- Confirm web/device public planners behave unchanged and connected APIs still
  return the intentional disabled state.
- Review advisors and logs without exposing private rows or tokens.

Schema applied does not mean feature activated.

## Release order

| Order | Change | State after step | Approval |
| --- | --- | --- | --- |
| 1 | N0–N5 shared/mobile/catalogue code | Device-first journey; no planning schema | Each commit/push/preview separately |
| 2 | N6 transactional-setup migration PR and 41/41 evidence | One additive function reviewed and applied; no client distributed | Completed under exact migration approval |
| 3 | Approved N6 function verification | Setup RPC grants and rollback-only role checks pass | Completed under exact remote verification approval |
| 4 | N6 API/client code | Connected native slice deployable; app still undistributed | Merge/deploy approval |
| 5 | Narrow connected native beta | Approved test accounts can sync | Test-environment/distribution approval |
| 6 | N7–N9 product slices | Photography/tasks/payments/guests/tables | Normal code approvals; no implied schema |
| 7 | N10 sharing schema, code and later activation | One-partner sharing only | Migration, deploy and flag approvals separately |
| 8 | N12 account/store hardening | Public-release gates complete | Retention, migration, settings and distribution approvals |

## Forward recovery and rollback

Production migrations roll forward. Deleting tables or resetting an applied
version is not the rollback strategy.

- Before activation: keep the cloud flag off. If review finds a defect, correct
  it locally and produce a new reviewed migration before any client use.
- Security incident after schema apply: disable the capability first, then use
  a separately approved forward migration to revoke the affected grant/execute
  path or correct RLS. Do not rely on application rollback alone.
- Code regression: roll back/disable the API/client while leaving additive,
  inaccessible schema dormant.
- After user data exists: never drop or rewrite it to match an older app. Keep
  previous API contracts for the support window, export/snapshot before data
  transformations and use additive forward correction.
- Catalogue rollback: preserve historical planning items even when a public
  venue/supplier becomes unavailable.

Every recovery action remains subject to the same production-data, migration,
flag and deployment approvals as the original release.
