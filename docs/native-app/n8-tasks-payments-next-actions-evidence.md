# N8 tasks, payments and next actions evidence

Date: 1 September 2026

## Release boundary

N8 is split into two independently reviewable changes:

- N8A task reliability was merged through PR #78 at merge commit
  `e3a29d22aad6df3be7e34a455dff96ce29881163` and its unchanged web production
  surface was verified after deployment.
- N8B payments and next actions is isolated on
  `codex/native-app-n8-payments-next-actions`. It is a code-only change that
  reuses the existing versioned budget-plan contract and authenticated
  Planning Hub budget endpoint.

N8B does not add a table, migration, notification service, paid service,
native dependency or remotely distributed build. It does not change feature
flags, production data, supplier data or outreach.

## Product behavior

N8B adds a native payments and instalments screen that:

- lists planned budget costs in bounded batches rather than rendering an
  unbounded plan;
- converts legacy aggregate payment fields into one editable row without
  discarding existing information;
- records stable payment IDs, type, label, amount due, amount paid, due date
  and paid date;
- supports adding, editing, removing and explicitly marking a payment paid
  today;
- derives scheduled, paid, payment-status and next-deadline aggregates from
  the schedule;
- preserves in-progress decimal text until the user finishes entering an
  amount, so values such as `1.50` cannot collapse into a different amount;
- keeps unchanged payment rows memoized; and
- preserves an accessible success/error announcement across a canonical item
  version refresh.

Today now routes a task recommendation to Tasks and an overdue payment
recommendation to the exact cost in Payments. Its Coming up section selects
the nearest dated task and payment. The existing venue and photography
recommendation transitions remain intact.

## Reliability and security

Payment edits use the same device-first plan mutation path as the rest of the
native budget. Connected saves retain the existing bearer-authenticated,
RLS-protected and exact-version budget update. If a response is lost, the
client reads the canonical budget and reports success only when its planning
content exactly matches the intended content; a mismatch remains a
needs-attention outcome. Server-generated version timestamps are excluded from
the content comparison, but planning fields are not.

Same-item cloud hydration follows the canonical schedule automatically while
the editor is clean. If the couple has a local draft and the canonical
schedule changes, the draft stays visible, saving is blocked and an explicit
Load latest schedule action resolves the conflict. A canonical response that
matches the local draft is accepted without discarding the save confirmation.

The authenticated budget PATCH route now validates every new or changed
payment schedule before persistence. It compares schedule, cost, aggregate and
status fields, while leaving untouched legacy payment records compatible.
Valid cancelled costs retain their payment history rather than becoming
uneditable simply because the cancelled cost is excluded from budget totals.

Schedule validation rejects:

- more than 50 payments;
- duplicate or missing stable IDs;
- missing labels;
- invalid calendar dates, not merely date-shaped strings;
- paid dates without a paid amount;
- a row paid above its scheduled amount;
- payment amounts on an item whose planning cost is not set;
- and scheduled or paid totals above the recorded item cost.

Persisted schedules must also match their derived deposit total, paid total,
next due date, payment status and cost status.

No Supabase change is required: schedules remain within the existing
user-owned `budget_plans.plan_json` record and its current ownership/RLS
boundary.

## Verification

The completed local gates before the final draft PR were:

- payment-schedule domain tests: 7 passing;
- full shared planning-domain tests: 2 suites and 8 tests passing;
- focused N8B native tests covering payment UI, reliability, connected
  recovery, Today recommendations and Plan routing;
- final full native test suite: 34 suites and 135 tests passing;
- full web test run: 132 suites and 605 tests passing, including 12 Planning
  Budget API route tests;
- package tests: planning-domain 8, planning-contracts 2 and Planning API
  client 18 passing;
- all local planning, supplier-owner, supplier-claim, Data API grant and
  outreach migration security verifiers passing;
- web lint passing with the unchanged Open Graph `<img>` warning in
  `src/app/venues/[slug]/opengraph-image.tsx`;
- native lint and full repository typecheck passing;
- all 19 Planning API contracts current;
- production Next.js build passing with 92 generated routes; and
- production migration alignment still 41/41 with zero pending migrations.

## Android runtime smoke

The existing free `everaft_n3_android` emulator cold-booted with package
`uk.co.everaft.mobile` installed and loaded the N8B Metro bundle. Android's
System UI presented one emulator-only ANR dialog during headless startup;
choosing Wait restored normal focus and the EverAft process remained resumed.

The device-only smoke then verified:

- Today rendered with the local-storage status and its recommendation;
- Plan rendered the budget and accessible Tasks/Payments actions;
- Payments rendered both its empty state and cost selector;
- a manual £12,000 cost opened the editor;
- Add payment exposed accessible type, label, due/paid amount, date, remove,
  mark-paid-today and save controls;
- amounts and the paid-today date updated on-device; and
- no fatal React Native, unresolved-module or Android runtime error was found.

The disappearing post-save confirmation observed during this smoke was fixed
before the PR by retaining the editor across a server-version timestamp
refresh. A regression test proves both the confirmation and entered schedule
remain visible after that refresh.

This is emulator evidence, not a claim that a physical Android or iPhone build
has been distributed. Physical-device, signing and distribution gates remain
separate release work.

## Rollback

N8B is code-only. Before merge, close the draft PR. After merge, revert its
squash commit and redeploy the reverted main commit. No database rollback,
data repair, flag change or service removal is required.
