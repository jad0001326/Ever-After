# Native app backend change plan

Date: 20 August 2026

Status: local planning artifact. This document does not authorise SQL creation,
a Supabase branch/project, a migration dry run against a linked project, a
remote migration, production test data, a flag change or a deployment.

## Verified live baseline

A read-only Supabase inspection on 20 August 2026 confirmed:

- production records exactly 26 migrations, ending with
  `20260813074826_lock_down_profile_role_updates`;
- the live `public` schema contains `budget_plans`, catalogue, supplier,
  outreach and enrichment tables, all reported with RLS enabled;
- no `planning_workspaces`, `planning_workspace_members`, planning profile,
  task, guest, table, seat, seating-rule or workspace-invite table exists;
- `pgcrypto` 1.3 is installed in `extensions`, satisfying the existing hashed
  invitation-token dependency; and
- the repository has 36 timestamped migrations: the 26 live versions plus ten
  older pending files.

The ten pending files are not one release:

| Workstream | Pending source files | Native dependency |
| --- | --- | --- |
| Planning Workspace | Five files from `20260726140200` through `20260726191406` | Design/input only; must be reviewed and reissued, never applied unchanged as a tranche |
| Supplier owner updates | `20260803122711_supplier_owner_update_requests.sql` | None for couple native MVP |
| Supplier catalogue staging | `20260803130045_supplier_catalogue_staging.sql` | None; staging/admin data must not enter native APIs |
| Data API grant tightening | `20260803143000_tighten_data_api_table_grants.sql` | Separate platform/security work; do not couple implicitly |
| General supplier outreach | `20260803150000_generalize_supplier_outreach.sql` | None; native couple actions must not alter outreach |
| Supplier image submissions | `20260803165651_supplier_image_submissions.sql` | None; native consumes approved public imagery only |

The repository alignment verifier passes against this 26/10 snapshot, and the
live migration list independently matches all 26 recorded versions. The dated
JSON filename/capture field is historical and is not accepted as a substitute
for the live list at release time.

## Principle: add only a real client blocker

No database work is needed for N0–N5's local shell, onboarding, device plan,
venue discovery, bookmarks or comparison. Catalogue APIs adapt existing live
tables and RLS. The first remote schema dependency is N6 connected workspace
sync.

Realtime, Edge Functions, a new Storage bucket, queues, cron, vector/search
extensions and push-token tables are not MVP prerequisites. They remain absent
until a measured client outcome requires them.

## API and database impact matrix

| Boundary | Current main | Database impact | Release slice |
| --- | --- | --- | --- |
| `GET /api/planning/v1/workspaces` | Exists, cloud-gated | Requires workspace/member tables | N6 |
| `GET .../{id}/dashboard` | Exists, cloud-gated | Requires core workspace/profile/task/table/budget links | N6 |
| `PATCH .../{id}/budget` | Exists, CAS-gated | Requires linked-budget member RLS | N6 |
| `GET .../{id}/budget` | Missing | Code/contract only after N6 schema | N6 |
| `GET/PATCH .../{id}/profile` | Exists, cloud-gated | Requires workspace profile and membership RLS | N6 |
| `PATCH .../{id}/setup` | Missing | Requires new transactional setup function | N6 |
| `GET/POST .../{id}/tasks` | Exists, cloud-gated | Requires planning task table/RLS | N6/N8 |
| `GET .../{id}/tasks/{taskId}` | Missing | Code/contract only; no new table | N8 |
| `PATCH/DELETE .../{id}/tasks/{taskId}` | Exists, cloud-gated | Requires planning task table/RLS | N6/N8 |
| `GET/PATCH .../{id}/table-plan` | Exists, cloud-gated | Requires guest/table/seat/rule tables and sync function | N6/N9 |
| `POST /api/planning/v1/workspaces/import` | Missing | Uses reviewed snapshot import function | N6 |
| Venue/supplier list/detail APIs | Missing | Existing published catalogue tables; no new schema | N5/N7 |
| Favourite list/mutations | Missing | Existing `favourites`/`supplier_favourites` RLS; no new schema | N5/N7 |
| Partner sharing APIs | Missing | Requires hardened invitation/membership constraints/functions | N10 |
| Account export/deletion APIs | Missing | Data-inventory result determines minimal private job/receipt schema | N12 |

All native-facing Next routes remain behind product capability checks where
their schema can be absent. A missing table is never turned into a client-visible
database error or silently handled as an empty plan.

## N6 schema package

The five dormant Planning Workspace files are design sources, not application
instructions. N6 reconstructs the smallest connected schema in newly generated
migrations whose versions are later than the then-current live ledger.
`supabase migration new <descriptive_name>` creates each file; timestamps are
never invented in planning documents.

### N6-DB1 — Owner workspace core

Objects:

- `planning_workspaces` and protected owner membership;
- tasks, guests, tables, seats and seating rules;
- workspace wedding profile;
- required indexes on owner/member/workspace/filter and deterministic-order
  columns;
- update/touch triggers with cascade-safe behavior;
- RLS on every exposed table before a client can use it; and
- explicit least-privilege table and column grants in the same migration as
  the corresponding RLS policies.

N6 does not need the invitation table or acceptance function. Membership exists
because it is the authorization model and future partner boundary, but only the
owner membership can be created in this slice. Direct owner/member mutation
grants not needed before N10 remain revoked.

### N6-DB2 — Budget/profile import and access

Objects:

- member access to the workspace-linked owner budget plan;
- versioned snapshot import with one-megabyte and collection-size ceilings;
- complete profile import; and
- precise execute grants for the authenticated caller only.

Import runs as `SECURITY INVOKER`, so caller grants and RLS remain authoritative.
It uses stable device workspace/budget IDs and returns an existing identical
import after an ambiguous lost response rather than duplicating it.

### N6-DB3 — Transactional setup

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

### N6-DB4 — Complete table-plan sync

Reissue the bounded table-plan synchronization behavior with current security
review. If `SECURITY DEFINER` remains necessary, the function must:

- use an empty search path and fully qualified relations;
- reject a missing caller;
- perform an explicit live membership check before any write;
- lock the workspace and compare the expected version;
- retain collection/payload limits and seating-capacity validation; and
- revoke default execute before granting only the intended role.

The current whole-table-plan CAS uses workspace `updated_at`, which can change
after unrelated task/profile writes. The API therefore GETs and compares
canonical table content after a conflict and retries only when table content is
unchanged; DB4 does not introduce unsafe last-write-wins behavior.

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

## Allowlisted migration release workdir

The normal repository migration directory cannot safely drive native activation
while ten older migrations from several workstreams remain pending. N6 adds a
local generator for a temporary, ignored Supabase workdir:

1. fetch the live migration list read-only;
2. require exact equality with an approved release manifest containing version,
   name and source hash for every live migration;
3. copy only those exact live files plus the newly reviewed N6 migration files
   into the temporary workdir;
4. require each new version to be later than the latest live version;
5. scan SQL and filenames against an explicit denylist for supplier owner,
   catalogue staging, outreach, image-submission, seed and unrelated objects;
6. run the pinned CLI's `db push --help`, then an allowlisted `db push
   --workdir <generated-project> --linked --dry-run`;
7. parse the dry-run output and require the exact expected new migration set in
   exact order; and
8. destroy the temporary workdir after evidence is captured.

Hard prohibitions:

- no `--include-all`, `--include-seed` or `--include-roles`;
- no dashboard copy/paste or raw SQL apply that bypasses migration history;
- no `migration repair` to mark unapplied SQL as applied;
- no unresolved glob or current-directory assumption; and
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
| 2 | N6 migration PR and local release-workdir evidence | SQL reviewed, nothing remote | Commit/push only if approved |
| 3 | Approved N6 schema application | Tables/functions present; cloud flag still off | Exact remote migration approval |
| 4 | N6 API/client code | Connected code deployable but disabled | Merge/deploy approval |
| 5 | Narrow connected beta activation | Approved accounts can sync | Production flag approval |
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
