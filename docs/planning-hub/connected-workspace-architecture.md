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

Only a server action may create or accept invitations. Acceptance must
re-authenticate the caller, compare their normalized verified email, validate
expiry/revocation and consume the token once in a transaction.

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
- Invitation access and mutation: owner only. Partner acceptance is performed
  by the narrow server-side transaction, not a broad client policy.

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
