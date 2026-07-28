# Planning Hub payment schedules

Date: 26 July 2026

## Decision

Venue and photography commitments now use a shared payment schedule instead of
one aggregate deposit, paid total and due date. Each schedule can contain a
deposit, staged instalments, a final balance and other supplier-specific
payments.

The schedule is stored inside the existing `BudgetPlan` JSON document. No new
table, migration, Supabase branch or production write is required.

## Product behaviour

- Add, edit and remove up to 50 payment rows per budget item.
- Record the payment type, label, expected amount, amount paid, due date and
  paid date.
- Derive the aggregate deposit, paid total, payment state and next unpaid due
  date for existing Budget Planner calculations.
- Show the next three unpaid deadlines across the connected plan.
- Distinguish overdue, due-soon and upcoming payments.
- Preserve aggregate payment fields when an older plan is restored, then
  convert them into editable schedule rows on demand.
- Keep separately added rows independently addressable.
- Support website listings and manually added venues or photographers.
- Keep manually selected suppliers active after the workspace is reopened.

## Compatibility and persistence

`BudgetItem.installments` defaults to an empty array during schema validation
and legacy local restore. Existing plans therefore remain valid without a data
migration.

The older aggregate fields remain derived and populated:

- `depositPaidPence`;
- `totalPaidPence`;
- `dueDate`;
- `paymentStatus`;
- `costStatus`.

This preserves the public Budget Planner, exports and existing cloud
`budget_plans.plan_json` records while web and future native clients adopt the
more detailed schedule.

## Security

- The schedule remains inside the existing owner-scoped budget plan.
- Partner writes continue through the connected-workspace action and existing
  version conflict checks.
- No anonymous grant, new API endpoint or public schedule record is introduced.
- The database-level owner/partner/outsider RLS scenario now passes locally.
  Supabase Auth and Data API execution remains a release gate for a free local
  stack or approved disposable environment.

## Verification

Current local branch evidence:

- 44 test files and 219 tests passing;
- TypeScript check passing;
- ESLint passing with one pre-existing unrelated Open Graph image warning;
- optimized Next.js production build passing with 77 generated pages;
- venue and photography manual fallback, selection and payment editing verified
  in a real browser at 390 x 844;
- no horizontal overflow or relevant browser error;
- independent payment rows, legacy restore, deadline ordering and reopened
  manual selections covered by regression tests.

One optimized-production mobile Lighthouse run for `/planning-hub` measured:

| Metric | Result | Target |
| --- | ---: | ---: |
| Performance | 98 | at least 90 |
| LCP | 2.3 s | below 2.5 s |
| TBT | 30 ms | below 200 ms |
| CLS | 0 | below 0.1 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 100 |

The SEO score is intentionally reduced because the beta route is `noindex`.

A production-mode Event Timing sample covering manual entry and repeated
payment-row interactions observed six interactions between 32 ms and 184 ms.
This is useful lab evidence but is not claimed as field INP. Production INP
still requires consented real-user data after an approved release.

## Release gates

1. Run the existing RLS transaction tests against a free local Supabase stack.
2. Complete a physical Safari/iPhone smoke test.
3. Repeat signed-in owner and partner save/restore with a disposable test
   account in a non-production environment.
4. Present the exact migration and deployment plan for explicit approval.
5. Collect consented field INP after release.

## Rollback

Application rollback is isolated:

1. revert the shared payment-schedule component and workspace integration;
2. retain aggregate payment fields in saved plans;
3. treat any stored `installments` arrays as forward-compatible unused JSON;
4. preserve the public Budget Planner and all existing `budget_plans` records.

## Organise payment command centre

The Organise stage now turns the saved schedules into an actionable mobile
summary:

- overdue, due-soon and upcoming commitments are counted from shared payment
  logic rather than duplicated UI calculations;
- known outstanding amounts and schedules with a still-unknown amount are
  reported separately;
- each commitment links back to the relevant venue or supplier payment editor,
  preserving a validated shared-workspace identifier;
- five commitments render initially, with subsequent five-item batches
  available on demand so every deadline remains actionable without an
  unbounded first mobile render;
- the next-step recommendation prioritises the earliest overdue payment before
  returning to venue, photography, guest, table or task guidance;
- the UI is server-seeded with a serializable date string and introduces no
  client fetch or additional data waterfall.

The command centre is compatible with personal and partner workspaces and does
not introduce a schema change, migration, cloud feature or paid service.

Updated local verification:

- 51 test files and 248 tests passing;
- TypeScript check passing;
- ESLint passing with the same pre-existing unrelated Open Graph image warning;
- optimized Next.js production build passing with 77 generated pages;
- empty and overdue states verified in the optimized app at 390 x 844;
- the overdue scenario showed the expected £4,000 balance, payment-first
  recommendation and venue payment-editor link;
- no horizontal overflow or browser error was observed.
