# My EverAft connected workspace

## Decision

Guests, tasks, table arrangements and partner access should sit beneath a stable
`planning_workspace` identity. They should not be added to the existing
`budget_plans.plan_json` document.

The budget JSON remains the compatibility boundary for the public Budget
Planner and the venue/photography beta. The Planning Hub can reference that plan
while the connected records move to focused tables. This preserves the working
calculations and avoids turning every guest RSVP or task edit into a full budget
document overwrite.

## What is reused

- `src/lib/budget` remains the source of truth for budget calculations, booking
  states and payments.
- `src/lib/table-plan/planner.ts` remains the pure seating and conflict engine.
- `TablePlanner` remains available at `/wedding-table-planner`.
- The Planning Hub continues using server-rendered catalogue searches and small
  client interaction boundaries.
- Supabase Auth user IDs remain the authorization identity. User-editable
  metadata is never used for authorization.

## Domain boundary

```text
planning_workspaces
  ├── budget_plans (existing plan, linked during migration)
  ├── planning_tasks
  ├── planning_guests
  ├── planning_tables
  │     └── planning_seats
  ├── planning_seating_rules
  ├── planning_workspace_members
  └── planning_workspace_invites
```

`planning_workspaces` is the aggregate root. Records use UUID primary keys,
`workspace_id` foreign keys and timestamps. Guest, task and seating updates are
independent rows so web and future native clients can sync small changes without
overwriting unrelated work.

Suggested roles are `owner` and `partner`. Both can plan; only the owner can
invite or remove a partner, transfer ownership or delete the workspace.

## Proposed tables

### `planning_workspaces`

- `id uuid primary key`
- `owner_id uuid not null references profiles(id)`
- `name text not null`
- `budget_plan_id text null`
- `created_at`, `updated_at`
- unique `(owner_id, budget_plan_id)` when a budget plan is linked

### `planning_workspace_members`

- `workspace_id uuid`
- `user_id uuid`
- `role text check in ('owner', 'partner')`
- `created_at`
- primary key `(workspace_id, user_id)`

The owner is also recorded as a member. Ownership remains duplicated on the
workspace row deliberately: it gives deletion/invitation policies a simple,
non-recursive predicate.

### `planning_workspace_invites`

- `id uuid primary key`
- `workspace_id uuid`
- `email_normalized text`
- `token_hash text` (never store the raw invitation token)
- `role text default 'partner'`
- `invited_by uuid`
- `expires_at`, `accepted_at`, `revoked_at`, `created_at`

Only a server action may create or accept invitations. The raw 256-bit token is
returned once; only its SHA-256 hash is stored. Acceptance re-authenticates the
caller and invokes one narrowly granted database transaction that:

1. reads the caller's confirmed email from `auth.users`;
2. compares the normalized address and token hash;
3. locks the unexpired, unrevoked invitation;
4. marks it accepted by that exact user; and
5. inserts only a `partner` membership.

Invitees receive no direct table update permission for acceptance fields.
Owners can create and revoke invitations but cannot manufacture an accepted
invitation through the Data API. The acceptance function uses a fixed empty
search path, rejects anonymous callers and has `PUBLIC`, `anon` and
`service_role` execution revoked.

### Planning records

- `planning_tasks`: title, notes, status, category, due date, sort order.
- `planning_guests`: name, RSVP state, contact and dietary notes.
- `planning_tables`: name, capacity, locked state and sort order.
- `planning_seats`: one row per assigned guest, with table and seat index.
- `planning_seating_rules`: the existing four rule types and two guest IDs.

Contact and dietary fields are private planning data. No anonymous grants or
public read policies are permitted.

## RLS model

Every table enables RLS before application grants are added. `anon` receives no
privileges. `authenticated` receives only the operations required by the app;
`service_role` is explicit for operational tooling.

- Workspace `select`: owner or current member.
- Workspace `insert`: `owner_id = auth.uid()`.
- Workspace `update`: owner or current member, while ownership cannot change.
- Workspace `delete`: owner only.
- Child planning records: readable/writable when their `workspace_id` is in the
  caller's membership set.
- Membership `select`: workspace owner or the member themselves.
- Membership mutation: owner only; a user cannot promote themselves.
- Invitation reads/inserts and revocation: owner only. Partner acceptance is
  performed by the narrow transaction, not a broad client policy or
  `service_role` client.

All policies use `to authenticated`, explicit non-null identity checks and
indexed membership/ownership columns. Update policies have both `using` and
`with check`. Helper functions, if transaction requirements make one necessary,
belong in an unexposed private schema with a fixed `search_path` and narrowly
granted execution.

Supabase's April 2026 Data API change also means every intended table grant must
be explicit; table creation alone is not treated as API exposure.

## Migration and rollback

1. Create the workspace, membership and normalized planning tables with RLS,
   explicit grants, constraints and indexes.
2. Add nullable workspace linkage to `budget_plans`; keep all existing columns
   and policies working.
3. Backfill one workspace and owner membership per existing budget plan in a
   repeatable migration.
4. Deploy read support behind the beta route.
5. Dual-write only after local/disposable database RLS tests pass.
6. Migrate existing device table plans only after an explicit user confirmation.
7. Add invitation creation/acceptance after workspace isolation is verified.

Rollback is additive: disable the beta reads/writes, remove the nullable linkage
and drop the new tables in reverse dependency order. The original
`budget_plans.plan_json` and public planners remain intact throughout. No
production migration is applied without approval and a backup/checkpoint.

## Interface structure

The Planning Hub gains an `Organise` stage with:

- a compact next-step card and overdue task count;
- task list with large touch targets and simple status changes;
- guest count and RSVP summary;
- the existing seating planner, adapted to workspace data;
- partner access status, invitation controls and a clear access explanation.

On small screens these are progressive panels rather than a three-column
desktop compressed into a phone. The catalogue routes remain separate so task
or seating edits never re-render venue/photography result lists.

## Pull-request sequence

1. **Workspace domain:** types, validation, local persistence, next-step logic
   and adapters for the existing seating engine.
2. **Organise beta UI:** tasks, guests and table planning under
   `/planning-hub/organise`, preserving the public planner.
3. **Database foundation:** additive tables, budget linkage, RLS and disposable
   database tests. Prepare only until production migration approval is given.
4. **Cloud sync:** focused server actions and optimistic UI for individual
   planning records.
5. **Partner sharing:** hashed, expiring invitations and acceptance/revocation
   audit tests.
6. **Native-ready API:** stable DTOs, conflict/version fields and end-to-end
   authorization tests reusable by iOS and Android clients.

Each PR must pass focused unit tests, typecheck, lint and production build.
User-facing phases also require keyboard/screen-reader checks, 390px responsive
QA and three-run mobile Lighthouse verification against the stated targets.

## Portable domain boundary

The future native-client claim is now enforced rather than inferred. Twenty-three
declared modules contain the shared budget, planning-state, supplier-context,
recommendation, dashboard/update-contract, profile, task, guest, seating and
validation rules. The
source-level boundary test rejects:

- React or Next.js imports and client/server execution directives;
- browser globals, URL construction and device storage;
- Node runtime or environment access;
- Supabase clients and web navigation adapters.

`getPlanningRecommendationDecision` returns a platform-neutral target such as
`venue-search`, `photography-search`, `payment` with a stable plan-item ID, or
`organise` with a semantic anchor. `workspace.ts` is the web adapter that maps
that decision to a Planning Hub URL.
`createPlanningDashboardSnapshot` assembles the budget, payment, task, guest,
profile-completion and recommendation state into a versioned JSON-safe
contract. It rejects a workspace joined to the wrong budget plan and contains
no URL, Date, Map, framework object or persistence handle, so a future native
presentation adapter can consume the same dashboard decision state. Separate
workspace and budget update timestamps provide stable freshness tokens for a
future conditional-write contract.
The runtime contract is strict: unknown adapter fields are rejected. Its
language-neutral Draft 2020-12 schema is checked in at
`docs/planning-hub/contracts/planning-dashboard-snapshot.v1.schema.json` with
the stable ID `urn:everaft:planning-dashboard-snapshot:v1`. Run
`npm run planning-contract:check` to fail on schema drift or
`npm run planning-contract:write` after an intentional versioned contract
change. The generator maintains the dashboard snapshot plus the budget-update
and table-plan-update request and success schemas.
Catalogue queries, analytics, invitation cookies and internal-route helpers
remain explicitly outside the portable core.

The dormant
`GET /api/planning/v1/workspaces/{workspaceId}/dashboard` route is the first
native-consumable adapter for that contract. It verifies a Supabase Auth bearer
token, then uses the same caller-bound publishable-key client for every Data
API query so the existing owner/partner RLS remains authoritative. It is
dynamic, private, no-store and returns a generic 404 for both absent and
RLS-inaccessible workspaces. The server-only cloud flag remains the outer
fail-closed gate.

The dormant
`PATCH /api/planning/v1/workspaces/{workspaceId}/budget` route is the first
native mutation adapter. It validates the full plan, requires the dashboard's
exact budget version, refuses a different linked plan and conditions the
database update on the same `updated_at`. The server supplies the real owner ID
and writes only explicitly granted columns. This makes an owner/partner race a
visible 409 instead of a last-write-wins overwrite, without adding a migration
or privileged database function.

The dormant
`PATCH /api/planning/v1/workspaces/{workspaceId}/table-plan` route is the
second native mutation adapter. It validates the complete guest/seating
document, prechecks the dashboard's workspace version, then delegates to the
existing authenticated transaction that locks the workspace and atomically
replaces guests, tables, seats and rules. Owner and partner access remains
governed by the caller's RLS-visible workspace and the function's explicit
access check.
The boundary is verified by
`scripts/lib/planning-domain-boundary.test.mjs`; focused decision tests also
prove that the core result contains no `href`.

## Current cloud activation gate

The typed server actions live in `src/app/actions/planning-workspace.ts`. Every
action validates its payload, calls `auth.getUser()` on the server and then
relies on RLS for record-level authorization. Independent workspace reads run in
parallel and return narrow planning payloads. Task, guest, table, seat, seating
rule and invitation mutations write individual rows rather than replacing the
whole plan.

These actions remain dormant unless the server-only
`PLANNING_WORKSPACE_CLOUD_ENABLED=true` flag is present. It is intentionally not
a `NEXT_PUBLIC_` variable. The database-level migration and transaction-safe RLS
test now pass locally in embedded PostgreSQL. Do not enable the flag until the
same boundary has also passed through Supabase Auth and the Data API in a free
local stack or approved disposable environment.

Invitation links first enter a dedicated `/planning-hub/join/redeem` handler.
The handler validates the generated 43-character base64url token, moves it into
a one-hour, path-scoped `HttpOnly`, `SameSite=Lax` cookie and immediately
redirects to the clean `/planning-hub/join` URL. The raw token is therefore
never serialized into a React component, client bundle, form field or onward
login/signup redirect. Both the redirect and production join response are
`no-store` and apply no-referrer, noindex and anti-framing controls. Successful
acceptance expires the same path-scoped cookie.

## Cross-stage workspace continuity

Planning Hub links now carry a validated connected workspace through the full
journey:

- venue planning to photography;
- photography back to venue planning or forward to Organise;
- generic supplier planning back to venue planning or forward to Organise;
- Organise recommendations for venues, photography, guests, tables and tasks;
- Wedding Profile venue discovery;
- filter reset and empty-result recovery links.

`src/lib/planning-hub/navigation.ts` is the shared internal-route helper. It
preserves existing filters and hashes, adds exactly one `workspace` parameter
and replaces stale workspace context rather than duplicating it. Personal-plan
links remain byte-for-byte unchanged.

Client workspaces receive only the workspace ID returned by the validated
server context. An arbitrary or inaccessible `?workspace=` value can remain in
the stage header for navigation, but it is not trusted for local-storage
scoping or shared writes.

Local verification on 28 July 2026:

- focused continuity suite: 7 files and 38 tests passed;
- full suite: 49 files and 242 tests passed;
- TypeScript and optimized 77-page production build passed;
- lint retained only the unrelated pre-existing venue OG-image warning;
- at 390 × 844, venue → photography → Organise retained the workspace query,
  page width matched the viewport and browser errors were empty.

No hosted migration, production write, deployment or paid cloud branch was
used.

## Reproducible database security proof

`npm run test:planning-rls` creates an in-memory PostgreSQL database, installs
the pinned `pgcrypto` extension, models the pre-existing Supabase roles and Auth
identity helper, and applies the budget plus connected-workspace migrations
unchanged.

The verifier then checks the catalog contract for all ten user-owned planning
tables before executing `supabase/tests/planning_workspaces_rls.sql` inside a
transaction. It proves:

- RLS is enabled and `anon` has no table privileges;
- each writable planning table has command-appropriate policies;
- sensitive functions use fixed empty search paths and narrow execution grants;
- owners can create and replace their snapshots;
- partners can read and update shared planning records and the linked budget,
  but cannot transfer ownership, manage members or replace the owner snapshot;
- outsiders cannot read or mutate workspace, guest, profile or budget data;
- invitation acceptance requires the matching confirmed email, is single-use
  and does not expose direct acceptance-state updates;
- stale table-plan and snapshot writes fail; and
- anonymous table and function access is denied.

The first execution exposed an ambiguity between the
`import_planning_workspace_snapshot_v2` output variable and
`ON CONFLICT (workspace_id)`. The dormant migration now targets the named
primary-key constraint, and the full scenario passes.

This is a real PostgreSQL policy/grant test, but it does not emulate GoTrue,
PostgREST or cookie transport. A full free-local Supabase API/Auth smoke test
therefore remains a release gate.
