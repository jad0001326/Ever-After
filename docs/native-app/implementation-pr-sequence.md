# Native app implementation PR sequence

Date: 26 August 2026

Status: N0–N5 are merged. N6 is in local development only. This document does
not authorise a push, deployment, migration or external distribution.

## Sequencing principles

- Keep each pull request independently reviewable and reversible.
- Extract and prove existing logic before a mobile screen consumes it.
- Pair every new backend surface with the user journey that needs it.
- Preserve the live Next.js application at the repository root during MVP.
- Keep the device-only path usable while connected planning remains gated.
- Do not mix the supplier-claim release, old dormant migration tranche or
  unrelated supplier administration into the couple app shell.

## Proposed pull requests

### N0 — Architecture and MVP contract

Scope: the complete planning pack in this folder, decision log and any review
fixes.

Evidence: link check, factual cross-check against current main, clean markdown
diff and confirmation that there are no runtime or configuration changes.

Dependency: none.

Approval boundary: a separate approval is required to commit or push this local
documentation.

### N1 — Workspace and shared planning packages

Scope:

- introduce minimal npm workspace configuration without moving the web app;
- create `packages/planning-domain` and `packages/planning-contracts`;
- move portable modules and schemas with compatibility re-exports; and
- keep persistence, navigation, environment and framework imports outside;
- give packages explicit TypeScript-source exports and package-local typecheck
  scripts; and
- exclude the future `apps/mobile` tree from the root web TypeScript project
  while retaining separate mobile checking;
- introduce a package test job without weakening the existing web or database
  test sequence.

Evidence: existing web tests, portability boundary, contract alignment,
package typechecks, one root lockfile, clean `npm ci`, and the unchanged Vercel
production web build all pass with no behavior change. Record a reproducible
mobile-web Planning Hub baseline for Lighthouse, LCP, INP and CLS before the
extraction and compare it afterwards. The diff must not move the web app or
broadly rewrite existing dependency versions.

Dependency: N0 accepted.

Rollback: web imports revert to their previous locations; no database or user
data is involved.

### N2 — Expo shell and native quality baseline

Scope:

- add `apps/mobile` using a pinned Expo SDK and TypeScript;
- add four-tab navigation, authentication/onboarding route groups and design
  tokens;
- render a seeded, read-only Today screen through the shared domain package;
- add mobile lint, typecheck and test tasks to CI; and
- document local iOS/Android development without buying services.

The root Next project remains the Vercel build root. Mobile owns its Expo
TypeScript/Metro configuration and reuses the repository's single React
installation; domain packages remain React-free.

The web Vitest job explicitly excludes mobile tests, mobile uses its own React
Native test environment, and the aggregate `npm test` runs web, package, mobile
and the existing database/migration verifiers. ESLint follows the same
environment-specific split rather than applying Next-only rules to Expo code.

Evidence: clean install, native typecheck/tests, web test/build regression,
Android emulator and iOS Simulator smoke tests where available, plus accessible
tab labels and dynamic-text checks.

Dependency: N1.

External approval: pushing a branch or using any hosted build service.

### N3 — Authenticated API client and session boundary

Scope:

- typed EverAft API client generated or validated from current JSON Schemas;
- Supabase Auth with publishable key, secure token storage and refresh handling;
- bearer-token requests to EverAft APIs rather than direct screen-level database
  access;
- protected-route and deep-link restoration; and
- explicit `401`, offline and `connected_planning_disabled` behavior.

Session storage must be an EverAft adapter: either a physically verified
whole-session SecureStore implementation or an authenticated-encrypted envelope
whose small key lives in SecureStore. Preserve Supabase's `processLock`,
foreground refresh and `detectSessionInUrl: false` behavior. Add exact
Universal/App Link callback routing and keep a web fallback.

Evidence: maximum-size session fixtures, refresh rotation, interrupted storage
write, corrupted envelope, wrong key, cold restore, AppState listener lifecycle,
token redaction, local/global logout, account-switch isolation, expired session,
reinstall cleanup, Android backup/restore, PKCE reset callback and
hostile/incorrect deep-link tests. Storage and callback journeys must also pass
on physical iOS and Android devices before connected beta. No production
connection is required for the PR.

Dependency: N2.

External approval: creating or changing test credentials, environment values or
hosted preview configuration.

This PR defines but does not fake workspace creation. Until the import endpoint
ships in N6, a signed-in app may list an existing test workspace or continue in
device-only mode; it must not claim that a local plan is cloud-backed.

### N4 — Device-first onboarding and repository

Scope:

- onboarding basics, budget and priorities;
- versioned SQLite plan repository and SecureStore secret boundary;
- device-only Today snapshot and truthful storage labels; and
- import/export fixture for development recovery.

Evidence: create/reopen plan, process restart, offline edit, schema migration,
corrupt-cache recovery and core calculation parity tests.

Dependency: N2; may run in parallel with N3 only after shared interfaces settle.

Rollback: remove the local database during development; no remote state exists.

### N5 — Venue discovery vertical slice

Scope:

- add bounded venue search and venue-detail API routes to the web backend;
- add bounded venue/supplier-favourite list and mutation APIs over the existing
  caller-owned RLS tables, initially exposing the venue flow;
- reuse existing venue query logic and return numbered-page lightweight DTOs;
- build native search, filters, detail, bookmark, device-persisted comparison,
  shortlist, selection and manual entry; and
- persist the resulting planning selection through the device repository.

Before wrapping the current queries, harden venue detail against internal-test
IDs, add deterministic `id` tie-breakers, define explicit image status, and
keep public catalogue responses separate from caller bookmark state. V1 keeps
the existing eight-result numbered pages.

Evidence: query-boundary and stable-pagination tests, direct internal-test ID
denial, bookmark RLS/target/cache isolation, no full-catalogue client payload,
approved/representative/absent image fixtures, withdrawn-listing state, no
duplicate shortlist item, compare restoration, manual fallback, screen-reader
flow and representative slow-network profiling.

Dependency: N4; N3 for remote catalogue calls.

External approval: preview deployment and any production API deployment.

### N6 — Connected dashboard and budget

Scope:

- connect workspace discovery, dashboard, profile and whole-budget APIs behind a
  runtime capability check;
- add the versioned bearer-authenticated workspace-import endpoint over the
  existing transactional import RPC;
- add the missing full-budget GET contract used for initial hydration and
  ambiguous-write recovery;
- add the versioned setup endpoint and a `SECURITY INVOKER` transaction that
  updates total budget, mirrored date/guest/location and the complete profile
  all-or-nothing;
- map native/device models to existing schemas;
- show totals, item statuses, venue selection, payments and availability; and
- retain device-only operation when the cloud capability is off.

Evidence: shared calculation parity, budget read/update parity, two-client
setup atomicity/rollback/version tests, web/native setup parity, import
payload/size/idempotency/conflict contracts, `401/403/404/409/413/503`
handling, lost-response and ambiguous-retry recovery,
optimistic local response and a full real Auth/Data API harness in an approved
non-production environment.

Dependency: N3–N5.

Hard gate: production and the repository now match at 40/40, including the
reviewed Planning Workspace and conflict-normalization sequence. N6 must not
reissue any of that live SQL. Its only schema candidate is the later additive
transactional-setup function. A fresh read-only ledger check and linked dry run
must show exactly the 40 applied versions plus that one candidate; any second
pending file is a hard fail. Migration repair, include-all, seed and custom-role
flags are not release shortcuts.

External approval: any Supabase environment, migration application, flag change
or production connection.

### N7 — Photography and reusable supplier discovery

Scope:

- add bounded category search and supplier-detail APIs over
  `supplier_listings` and `supplier_categories`;
- ship photography as the first native supplier category;
- expose supplier bookmarks through the N5 favourite API contract;
- reuse the current selected-venue, Scottish-location and remaining-budget
  discovery context while keeping wedding-date availability unchecked;
- connect save/selection/manual entry to the photography budget category; and
- keep category configuration reusable without publishing empty categories.

The API rejects dormant categories at both list and detail boundaries, carries
`visualStatus` through the photography adapter, and returns a typed stale-venue
context instead of silently broadening matches.

Evidence: live-category list/detail denial, stable pagination, published-only
access, supplier-bookmark RLS/cache isolation, approved versus representative
imagery, stale-venue context, restored comparison, unique shortlist item, manual
entry, plan selection and mobile detail tests.

Dependency: N5 patterns and N6 plan integration.

External approval: production API deployment or enabling another category.

### N8 — Tasks, payments and next actions

Scope:

- native task CRUD through the existing API;
- add task-item GET and make stable-ID create retries return the identical
  existing task while rejecting same-ID/different-content collisions;
- payment/instalment editor through the budget contract;
- Today deadlines and recommendation transitions; and
- optional local notifications behind explicit permission.

Evidence: lost-create/lost-update/lost-delete task responses, same-ID collision,
idempotent task actions, overdue/date boundary cases, total/payment invariants,
venue-to-photography recommendation and notification denial path.

Dependency: N6 and N7.

External approval: remote push infrastructure is not part of this PR and would
need its own design and approval.

### N9 — Guests and table planning

Scope:

- guest editor and table-plan canvas/list alternative;
- map existing complete table-plan API and shared seating rules;
- preserve a safe link to the web tool until feature parity is verified; and
- protect contact and dietary data in cache and logs.

Evidence: seating invariants, accessible linear editing, offline reopen,
unrelated task/profile timestamp conflict retry, genuine two-device table-plan
conflict and sensitive-log scans.

Dependency: N6 plus successful P0 device use.

### N10 — Partner invitation and membership

Scope:

- replace cookie-oriented web action assumptions with narrow authenticated
  invitation/member API routes;
- native invite, accept, status and remove-access screens; and
- protected invitation deep links with token redaction.

The workspace migration sequence enforces one partner and one active invite,
adds serialized create/accept behavior, and makes same-account acceptance retry
idempotent. Preserve the current hash-only token storage, confirmed-email match,
empty search path and explicit execution grants. The raw link is returned once
for the OS share sheet; this PR sends no email or outreach.

Evidence: owner/partner/outsider RLS, owner-self invite denial, concurrent
different-email invites/acceptance, expiry/revoke/retry, same-token lost-response
recovery, wrong-account and enumeration denial, protected-owner removal, partner
removal/cache purge on reconnect, two-device update and auth-refresh tests in an
approved test environment.

Dependency: N3, N6 and isolated workspace schema path.

External approval: the reviewed sharing migration, any future invitation-email
delivery, production deployment and flag activation. Link sharing alone must
not contact suppliers or alter outreach.

### N11 — Offline mutation queue and conflict resolution

Scope:

- semantic operation queue with stable operation IDs and base versions;
- explicit budget operation types mapped to the existing pure-domain actions,
  never queued whole-plan replacement snapshots;
- idempotent replay, backoff and authenticated ownership checks;
- section-level conflict UI; and
- cache retention and logout rules.

Evidence: airplane-mode golden journey, killed-app recovery at each operation
state, duplicate/lost-response replay, safe rebase of unrelated partner edits,
same-field stop-and-resolve behavior, expired auth, server validation, partner
conflict and data-isolation tests.

Dependency: real usage evidence from N6, N8 and N10. Do not invent fine-grained
budget endpoints unless conflict evidence requires them.

### N12 — Internal distribution and public-release hardening

Scope:

- physical-device matrix, accessibility and performance remediation;
- shared web/native personal-data export endpoints with caller-scoped content,
  expiring artifacts and no secret/internal-review leakage;
- deletion-impact and idempotent deletion endpoints with fresh authentication,
  explicit shared-plan outcomes and truthful retry/terminal states;
- reviewed data inventory covering every profile/Auth foreign key, Storage
  ownership, audit retention and cascade/restrict behavior; no implicit cascade
  is accepted as the deletion specification;
- either atomic shared-plan ownership transfer or a deliberate partner-removal
  plus delete-for-everyone flow; never silent loss for a connected partner;
- session revocation, short-lived-JWT decision, post-delete cache/key/export
  erasure and support diagnostics;
- privacy disclosures and approved retention wording;
- crash/sync/API monitoring with redaction and ownership; and
- store metadata/build configuration, kept separate from public submission.

Evidence: iPhone and representative Android golden journeys, VoiceOver and
TalkBack, dynamic text, cold/cached budgets, offline recovery, account-scoped
export fixtures, expired-artifact denial, fresh-auth enforcement, changed-impact
invalidation, shared-owner/partner deletion cases, Storage cleanup, restrictive
foreign-key handling, lost-response retry, post-delete session denial and local
erasure, security review and release checklist. Repeat the production-mode web
Planning Hub journey and require Lighthouse at least 90, LCP below 2.5 seconds,
INP below 200 milliseconds and CLS below 0.1; report native physical-device
budgets separately.

Dependency: N2–N11 release scope complete.

External approval: the data-retention and shared-plan deletion/transfer policy;
any required deletion migration or Supabase Auth/JWT setting; Apple/Google
developer accounts, certificates, hosted builds, TestFlight/Play tracks, paid
monitoring, store submission and public release.

## Suggested delivery windows

These are elapsed ranges for a focused small team, not promises. Review time,
device access and the connected-schema decision are the largest variables.

| Outcome | Included work | Cumulative elapsed range |
| --- | --- | --- |
| Local interactive prototype | N0–N4 | 1–2 weeks |
| Venue-first connected alpha | N5–N6 | 3–5 weeks |
| Useful internal beta | N7–N11, with P1 scope adjusted by evidence | 6–10 weeks |
| Public store release | N12 plus review remediation | 10–16 weeks |

The quickest credible first milestone is the local device-only prototype. A
connected production app is not merely a UI exercise: it depends on separating,
applying and verifying the required workspace schema rather than activating the
older dormant migration tranche wholesale.

## Approval checkpoints

The following are deliberately separate decisions:

1. Commit the local N0 documents.
2. Push/open each implementation PR.
3. Create hosted previews or mobile builds.
4. Create or change Supabase/Vercel environment configuration.
5. Apply a reviewed migration to any remote database.
6. Change a production feature flag.
7. Merge and deploy each production code slice.
8. Create paid Apple, Google, monitoring or build services.
9. Distribute an internal build or submit publicly.

Approval for one checkpoint does not imply the next and does not change
supplier listings, outreach or PR #61.

## Release and rollback discipline

- Every backend addition ships disabled or unused until its matching client is
  verified.
- Database changes require preflight, backup/recovery notes, forward correction
  and RLS verification; application rollback alone is not a database rollback.
- Native releases tolerate the previous server contract for a documented
  support window because installed clients cannot be recalled instantly.
- API changes are additive within `/api/.../v1` during MVP.
- A broken connected capability falls back to an explicit offline/device state;
  it must not claim a remote save succeeded.
- Catalogue and planning rollbacks preserve user-entered historical items even
  if a listing becomes unavailable.
