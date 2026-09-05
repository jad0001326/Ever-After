# N9A guests and tables foundation evidence

Date: 1 September 2026

## Release boundary

N9A is a local, code-only slice on
`codex/native-app-n9-guests-tables`, stacked on the N8B commit `b32f8de` and
draft PR #79. It has not been pushed, opened as a PR, merged, deployed or
distributed.

N9A adds no table, migration, service, native dependency or paid
infrastructure. It does not change production data, feature flags, supplier
data or outreach. PR #79 and production remain unchanged.

## Product behaviour

The Planning API client now exposes the existing strict table-plan GET and
PATCH contracts and includes the complete table plan in connected workspace
hydration. The connected provider maps that canonical resource into the native
device model rather than continuing to show a seeded local table plan after
connection.

Plan now includes compact Guests and Tables actions and privacy-safe counts.
Today routes guest and table recommendations to those exact native summaries.
The summary screens deliberately do not expose names, email addresses or
dietary-note contents.

Full editing remains on the web until the N9B and N9C native editors pass their
release checks. A connected plan opens its RLS-protected Organise workspace at
the guest section. A device-only plan is explicitly labelled as opening a
separate public planner whose data does not sync back to the native plan. No
access token or private plan content is placed in the handoff URL.

## Reliability and compatibility

Table-plan writes save on the device first and use the exact canonical
workspace timestamp for the connected PATCH. Recovery is deliberately narrow:

- a lost response is accepted only when a canonical GET matches the intended
  plan content;
- an unrelated task or profile timestamp change retries once only when the
  canonical table content still matches the operation's base plan; and
- a genuine table-plan divergence preserves the device draft and reports
  `Needs attention` instead of choosing a winner.

Transport timestamps and seating-rule query order do not create false
conflicts. Guest and table ordering remains meaningful because it controls the
planner's stable display order.

Older device plans remain readable if a declined guest retained a stale seat.
Every new native save and atomic device-to-cloud import clears that seat, the
web loader omits it from the canonical resource, and direct API writes that try
to create the contradiction are rejected. This avoids turning a recoverable
legacy state into a corrupt-device-plan failure.

## Verification

Completed local gates:

- focused N9A native tests: 7 suites and 25 tests passing;
- full native suite: 37 suites and 149 tests passing;
- full web suite against the N9 source packages: 144 suites and 640 tests
  passing;
- shared packages: planning-domain 9, planning-contracts 3 and Planning API
  client 20 tests passing;
- table-plan route, loader and contract focus: 18 tests passing;
- full repository typecheck passing;
- web and native lint passing, with only the unchanged Open Graph `<img>`
  warning;
- all 19 checked Planning API contracts current;
- local Planning Workspace RLS, Data API grant, supplier-owner,
  supplier-claim and outreach-migration verifiers passing; and
- production-mode Next.js build passing with 92 generated routes.

The installed Android emulator could not start this pass because the host had
1.98 GB free and the Android tooling rejected the launch for insufficient disk
space. No files were deleted to manufacture space. N9A therefore has no new
emulator or physical-device runtime claim; those gates remain pending.

No production migration query was rerun because N9A changes no migration and
this local slice did not authorise a new hosted production request.

## Remaining N9 work

- N9B: bounded/virtualized guest list, add/bulk-paste/search/edit/delete,
  decline-to-unseat behaviour, offline reopen and sensitive-log scan.
- N9C: native table and seating editor, accessible linear alternative, locks,
  rules, generation/undo and real two-client conflict evidence.
- Current small-iPhone and representative Android physical-device checks,
  VoiceOver/TalkBack and distribution remain later release gates.

## Rollback

Before push, discard the isolated local branch. After any later merge, revert
the N9A squash commit. No database rollback, data repair, flag change or
service removal is required.
