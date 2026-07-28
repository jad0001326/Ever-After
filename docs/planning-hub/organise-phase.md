# Planning Hub organise phase

## Delivered locally

- Added `/planning-hub/organise` as a beta, noindex route.
- Connected task state, guest/table state and the current budget plan through a
  versioned local workspace contract.
- Reused the existing seating engine and public Table Planner instead of
  rebuilding table placement and conflict logic.
- Migrates the existing device table plan into the new local workspace when the
  couple first opens Organise.
- Added logical next-step guidance in this order: overdue payments, overdue
  tasks, venue, photography, guests, tables, then open tasks.
- Added a partner-access explanation without exposing a misleading public edit
  link or enabling insecure sharing.
- Deferred the full seating canvas until the user opens it. This preserves an
  immediate initial Organise screen while keeping the complete editor available.

The public `/wedding-table-planner` and `/wedding-budget-planner` routes remain
available and retain their existing storage behavior.

## Architecture and security

`connected-workspace-architecture.md` records the normalized workspace,
membership, invitation, task, guest, table, seat and seating-rule model.

The additive migration draft was generated with the Supabase CLI:

- `supabase/migrations/20260726140200_planning_workspace_foundation.sql`
- `supabase/tests/planning_workspaces_rls.sql`

The migration includes explicit Data API grants, no anonymous planning access,
owner/partner RLS boundaries, owner-role integrity triggers, fixed-search-path
authorization helpers, hashed invitation tokens and owner-only invitation
management. Invitation acceptance is an atomic, narrowly granted operation tied
to the caller's confirmed `auth.users` email; invitees cannot directly update
acceptance fields.

The migration and RLS test files parse successfully as PostgreSQL (107 migration
statements and 48 test statements). They were not executed because Docker/local
Supabase is unavailable on this machine. They must run against a local database
before production approval. No billable Supabase development branch will be
used. Until a free local PostgreSQL/Supabase runtime is available, the migration
stays unapplied and cloud activation remains blocked by the server-only flag.

Typed, authenticated cloud actions are now prepared for workspace loading and
individual task, guest, table, seat, seating-rule and invitation mutations. They
remain unreachable from the interface and return a disabled response unless the
server-only `PLANNING_WORKSPACE_CLOUD_ENABLED=true` flag is explicitly enabled.

The partner join route is also prepared locally. It converts the token-bearing
URL into a clean URL plus a one-hour HttpOnly cookie before rendering, preserves
the clean route through sign-in or account creation, and never sends the raw
token to a client component. The acceptance control only appears for a signed-in
user with a confirmed email while the server-only cloud flag is enabled.

No migration was applied, no production data was changed and no deployment was
performed.

## Validation

- Focused Organise/workspace/Table Planner tests: passed.
- Full suite: 37 files, 179 tests passed.
- TypeScript: passed.
- ESLint: zero errors; one pre-existing unrelated `<img>` warning remains in
  `src/app/venues/[slug]/opengraph-image.tsx`.
- Production build: passed; 77 static pages generated, Organise is statically
  rendered, and both invitation routes are dynamic.
- Browser QA:
  - correct route and title;
  - no framework overlay;
  - no relevant console warnings/errors;
  - task add/complete updated the open count;
  - guest add updated the guest count;
  - task/guest state survived reload;
  - full seating editor opened on demand;
  - 390 x 844 viewport had no page-level horizontal overflow.
  - invitation tokens redirect to a clean URL and never appear in rendered
    controls;
  - production responses set `Secure`, `HttpOnly`, path-scoped invite cookies,
    `no-store`, no-referrer, noindex and anti-framing protections;
  - the compact 390 x 844 invitation screen exposes the primary sign-in action
    without the full Planning Hub hero pushing it below the fold;
  - invitation route and home route rendered without framework overlays or
    browser errors.

## Mobile Lighthouse

The first implementation eagerly hydrated the complete seating canvas and scored
68 performance with roughly 3.16s LCP and 1.36s total blocking time.

After deferring that editor, three production-server mobile samples were:

| Run | Performance | Accessibility | Best practices | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 84 | 100 | 100 | 2,473ms | 532ms | 0 |
| 2 | 98 | 100 | 100 | 2,052ms | 103ms | 0 |
| 3 | 99 | 100 | 100 | 2,076ms | 54ms | 0 |

Median: performance 98, accessibility 100, best practices 100, LCP 2.076s,
TBT 103ms and CLS 0.

The initial cold sample occurred while the 8GB test machine had about 1.2GB free
memory and Lighthouse repeatedly reported temporary-profile cleanup errors. The
median is therefore the release measure, while the cold outlier remains useful
evidence for retaining the deferred editor.

## Next release gates

1. Execute the new migration and RLS tests on a disposable database.
2. Review the migration output and query plans before requesting production
   migration approval.
3. Wire the prepared cloud actions into Organise behind the disabled cloud flag.
4. Dual-write only behind the Organise beta, with rollback to the local
   workspace.
5. Run browser and end-to-end partner-sharing checks with two isolated test
   accounts before asking to enable cloud sync.

## Scheduled task management

The Organise action list now exposes the scheduling fields that were already
present in the shared task contract:

- couples can create tasks with a planning category and optional due date;
- task title, category and due date can be edited without recreating the task;
- active tasks are ordered by overdue, due today, due within 30 days, later
  scheduled and unscheduled work, with completed tasks retained at the end;
- overdue, due-today and due-soon counts come from shared domain logic suitable
  for web and future native clients;
- the next-step engine prioritises the earliest overdue task after any overdue
  payment and before ordinary venue or supplier discovery;
- recommendations link directly to the task heading and preserve a validated
  shared-workspace identifier;
- the Scottish calendar day is derived in `Europe/London`, avoiding a one-day
  error around the summer UTC boundary.

Form and row state are isolated into small client components, so typing into one
task does not re-render the complete checklist. Existing local persistence and
prepared owner/partner cloud actions continue to use the same task DTO and RLS
boundary.

Updated local verification on 28 July 2026:

- 54 test files and 256 tests passing;
- TypeScript check passing;
- ESLint passing with the same pre-existing unrelated Open Graph image warning;
- optimized Next.js production build passing with 77 generated pages;
- task creation, category selection, editing, overdue guidance and recommendation
  routing verified in the optimized app at 390 x 844;
- page width matched the viewport and browser errors were empty.

No migration, cloud activation, production write, deployment or paid service was
used.
