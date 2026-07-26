# Planning Hub organise phase

## Delivered locally

- Added `/planning-hub/organise` as a beta, noindex route.
- Connected task state, guest/table state and the current budget plan through a
  versioned local workspace contract.
- Reused the existing seating engine and public Table Planner instead of
  rebuilding table placement and conflict logic.
- Migrates the existing device table plan into the new local workspace when the
  couple first opens Organise.
- Added logical next-step guidance in this order: venue, photography, guests,
  tables, then open tasks.
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
or disposable development branch before production approval.

Typed, authenticated cloud actions are now prepared for workspace loading and
individual task, guest, table, seat, seating-rule and invitation mutations. They
remain unreachable from the interface and return a disabled response unless the
server-only `PLANNING_WORKSPACE_CLOUD_ENABLED=true` flag is explicitly enabled.

No migration was applied, no production data was changed and no deployment was
performed.

## Validation

- Focused Organise/workspace/Table Planner tests: passed.
- Full suite: 35 files, 172 tests passed.
- TypeScript: passed.
- ESLint: zero errors; one pre-existing unrelated `<img>` warning remains in
  `src/app/venues/[slug]/opengraph-image.tsx`.
- Production build: passed; 77 static pages generated and Organise is statically
  rendered.
- Browser QA:
  - correct route and title;
  - no framework overlay;
  - no relevant console warnings/errors;
  - task add/complete updated the open count;
  - guest add updated the guest count;
  - task/guest state survived reload;
  - full seating editor opened on demand;
  - 390 x 844 viewport had no page-level horizontal overflow.

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
3. Add the noindex/no-referrer invitation join page and wire the already
   prepared actions behind the disabled cloud flag.
4. Dual-write only behind the Organise beta, with rollback to the local
   workspace.
5. Run browser and end-to-end partner-sharing checks with two isolated test
   accounts before asking to enable cloud sync.
