# Native app decision log

Date: 20 August 2026

Status: local planning record. A decision here constrains future implementation
but does not authorise a commit, dependency install, hosted build, deployment,
migration, production setting, outreach action or paid service.

## How to use this log

- `Accepted` decisions remain the default until their stated revisit trigger is
  met and a replacement decision is recorded.
- `Evidence pending` identifies a bounded choice that cannot be made honestly
  before the named implementation PR produces evidence.
- A PR that contradicts an accepted decision must update this log and explain
  the migration/rollback effect rather than drifting silently.
- Exact third-party versions are selected and pinned in the PR that first adds
  them. This log does not freeze a version before compatibility is tested.

## Current repository constraints

The plan currently targets `origin/main` at
`880a4eeaabdb497742ede9712a8b14cf19a17cec`.

- The Next.js application lives at the repository root and Vercel builds that
  root. `vercel.json` currently changes only the deployment region.
- The repository uses npm with a version 3 root lockfile and has no npm
  workspaces yet.
- The root TypeScript configuration includes every `.ts` and `.tsx` file except
  `node_modules`; adding `apps/mobile` without exclusion would incorrectly mix
  Next/browser and React Native type environments.
- The current lock resolves Next 16.2.12, React/React DOM 19.2.6,
  `@supabase/supabase-js` 2.105.4, `@supabase/ssr` 0.10.3 and TypeScript 6.0.3.
  Several root manifest ranges use `latest`; N1/N2 must not turn native setup
  into an unrelated whole-repository dependency-normalisation change.
- There is no native application scaffold in current main.

These are observed facts, not promises that the versions remain current. N1
rechecks main and the lockfile before changing workspace configuration.

## Accepted decisions

### D001 — Keep web and native in one repository

Status: Accepted for N0–N12.

Decision: add `apps/mobile` and shared `packages/*` while leaving the Next.js
application at the root.

Why: the clients need one source for budget, recommendation and API contracts;
moving the established web app is unrelated risk.

Rejected now: a separate native repository; moving web into `apps/web` as a
prerequisite.

Revisit when: independent release permissions or repository scale create a
measured operational problem that package boundaries cannot solve.

### D002 — Use Expo/React Native with TypeScript

Status: Accepted architecture; exact SDK evidence pending N2.

Decision: Expo provides the iOS/Android client shell. Select an SDK compatible
with the repository's resolved React version and supported Node/toolchain,
install exact versions and commit the single updated lockfile.

Rejected now: two separate Swift/Kotlin applications; a web wrapper as the
primary product; unpinned native dependencies.

Revisit when: a required user journey cannot meet accessibility, performance or
platform capability budgets with measured Expo evidence.

### D003 — Keep the root web build isolated

Status: Accepted.

Decision: root `tsconfig.json` excludes `apps/mobile`; packages and mobile have
their own typecheck/test/lint environments. Next explicitly transpiles only the
shared packages it consumes. Vercel keeps the current root/build behavior.

Rejected now: letting Next discover the Expo tree; applying Next ESLint/Vitest
rules to native tests; weakening aggregate tests to make the monorepo pass.

Revisit when: the web app is deliberately moved in its own separately approved
repository-structure PR.

### D004 — Share domain rules and contracts, not UI or persistence

Status: Accepted.

Decision: `planning-domain` remains React/framework/storage-free;
`planning-contracts` owns versioned DTO validation; `api-client` owns transport.
Web and native retain their own presentation, navigation and persistence.

Rejected now: duplicating budget/recommendation rules in screens; sharing React
components across DOM and native; moving Supabase/Next adapters into domain.

Revisit when: a proven pure module falls outside the current package map.

### D005 — Native uses EverAft HTTPS APIs for connected data

Status: Accepted.

Decision: authenticated native calls carry a caller bearer token to narrow,
versioned EverAft APIs. Server catalogue adapters enforce publication, payload,
privacy and pagination rules. RLS remains the final authorization boundary.

Rejected now: embedding a service-role key; distributing direct PostgREST calls
through screens; bypassing disabled connected-planning gates.

Revisit when: a measured API bottleneck cannot be solved within the typed
boundary without weakening authorization or client compatibility.

### D006 — Deliver a device-first prototype before cloud activation

Status: Accepted.

Decision: N2–N5 can prove a useful local journey without remote planning
schema changes. Connected mode is explicit and unavailable when the server
capability is off; no interface implies cloud backup in device-only mode.

Rejected now: applying the dormant migration tranche just to unblock UI work;
mocking a remote save as success.

Revisit when: the local golden journey passes and N6's isolated schema/API path
has its own approval.

### D007 — Use four primary tabs

Status: Accepted for MVP.

Decision: Today, Discover, Plan and You. Guests/tables live under Plan. Modal
details remain deep-linkable and accessible.

Rejected now: mirroring the web navigation; a permanent tab per planning tool;
a generic inspiration/social tab.

Revisit when: observed task success or accessibility testing shows the hierarchy
is causing a material navigation problem.

### D008 — Preserve explicit decision states

Status: Accepted.

Decision: saved is a bookmark, compared is a device-local set of up to three,
shortlisted is a plan item, selected venue sets `selectedVenueId`, and only
booked cost is committed. Estimated, quoted, booked, partially paid and paid
remain distinct.

Rejected now: treating every save as a shortlist/budget item; using imagery or
availability as evidence of a booking.

Revisit when: shared comparison becomes a proven couple need, in which case it
gets a versioned contract rather than changing the existing meaning.

### D009 — Use eight-result numbered catalogue pages in V1

Status: Accepted.

Decision: reuse the current bounded numbered-page model, deterministic ID
tie-breakers and on-demand galleries. Keep loaded pages while filters are stable.

Rejected now: downloading the catalogue; inventing a cursor before evidence;
fabricating image dimensions.

Revisit when: measured catalogue size or latency makes exact totals/page offsets
miss the response budget; replace through a versioned cursor contract.

### D010 — Wedding profile owns connected setup basics

Status: Accepted; schema work approval pending N6.

Decision: connected date, guest count and location are profile-owned; budget
JSON keeps compatibility mirrors; total budget remains budget-owned. One
transactional setup boundary updates both representations or neither.

Rejected now: parallel client writes; silently choosing whichever copy is most
recent; activating the five existing workspace migrations unchanged.

Revisit when: the compatibility budget fields can be removed through a measured,
versioned web/native migration.

### D011 — Queue semantic offline operations

Status: Accepted.

Decision: offline mutations carry stable operation IDs, target/base versions
and intent. Whole-budget snapshots are never captured as queued operations.
Conflicts auto-rebase only when the operation's explicit preconditions remain
true; otherwise the user resolves the affected section.

Rejected now: last-write-wins for budgets/tables; a general event-sourcing
platform before the golden journey produces conflict evidence.

Revisit when: N6/N8 usage demonstrates that a narrower item API materially
improves safety or performance.

### D012 — One owner and one partner in MVP

Status: Accepted; schema/API approval pending N10.

Decision: at most one partner and one active email-bound invite. Acceptance is
serialized and retry-idempotent; the OS share sheet is the only delivery action
in the slice. Offline revocation limitations are explained and cache is purged
on reconnect.

Rejected now: group collaboration; automatic invite email; invitation tokens in
SQLite, analytics, logs, notification content or automatic clipboard access.

Revisit when: verified couple behavior demonstrates a need for additional
collaborators and the privacy/role model is redesigned.

### D013 — Treat account export/deletion as shared platform behavior

Status: Accepted; retention/transfer decisions pending N12.

Decision: web and native use the same caller-bound export, impact and idempotent
deletion services. Database cascades do not define product behavior. Shared
plans, Storage, audit retention and post-delete token/cache behavior are
explicitly resolved and tested.

Rejected now: mobile-only deletion; support-ticket-only deletion; reporting
success before Auth refresh capability is removed.

Revisit when: approved legal/retention requirements change.

### D014 — Photography first; category breadth is evidence-gated

Status: Accepted.

Decision: one reusable supplier discovery treatment ships photography first.
Every other category requires meaningful published coverage, truthful imagery,
useful filters, complete profiles and verified mobile behavior. Manual entry
remains visible.

Rejected now: empty category shells; copying directory breadth; treating staged
or projected suppliers as live.

Revisit when: the supplier readiness audit proves the next category's gate.

### D015 — No supplier/admin native app or commercial billing in MVP

Status: Accepted.

Decision: the native MVP serves couples. Supplier claims/owner self-service stay
in their separately gated web workstream. No prices, paid tiers, subscriptions
or outreach mechanics are invented in native.

Rejected now: using native scaffolding to expand PR #69; adding payment/provider
infrastructure before a commercial decision.

Revisit when: couple beta evidence and a separately approved supplier/commercial
specification justify it.

### D016 — Deploy database changes from an explicit release manifest

Status: Accepted architecture; implementation and remote use require separate
approval.

Decision: generate a temporary Supabase project workdir from an allowlist of
the exact live migration history plus only newly reissued migrations approved
for one release. Compare the live ledger before every dry run and apply. The
normal repository contains ten older pending files across multiple workstreams,
so `--include-all` is forbidden for native Planning Workspace activation.

Rejected now: applying the dormant ten-file tranche; using migration repair to
pretend unapplied SQL ran; copying SQL into the dashboard without migration
history; relying on filename order without an allowlist/hash check.

Revisit when: the active repository migration directory exactly matches the
live ledger plus one independently deployable release, making the generated
workdir unnecessary.

## Evidence-pending decisions

| ID | Decision due | Options to prove, not assume | Required evidence | Default if unresolved |
| --- | --- | --- | --- | --- |
| E001 | N2 exact Expo SDK and native package versions | Current supported Expo/React/Node combination | Clean install, doctor checks, iOS/Android smoke, web build | Do not add the scaffold |
| E002 | N3 session-at-rest adapter | Whole-session SecureStore or authenticated-encrypted envelope with key in SecureStore | Maximum-session, rotation, corruption, reinstall/backup and physical-device tests | No connected sign-in build |
| E003 | N3 API server adapter | Existing Next bearer verification or a current supported Supabase server package | Caller identity, malformed/expired JWT, RLS and previous-client compatibility tests | Preserve current verified boundary |
| E004 | N4 local database library/schema | Expo-supported SQLite adapter and versioned repository | Migration, corruption, restart, backup-exclusion and query-budget tests | Device prototype remains seeded/read-only |
| E005 | N5 list implementation | Platform performant virtualized list compatible with selected Expo SDK | Long-page memory/render traces, focus restoration and screen-reader order | Explicit page loading without speculative prefetch |
| E006 | N11 client state/store tool | React primitives or a small pinned store | Render isolation, persistence ownership and bundle evidence | React primitives plus repositories |
| E007 | N12 shared-plan deletion outcome | Atomic ownership transfer or partner removal plus explicit delete-for-everyone | Data inventory, concurrency, policy and recovery review | Block deletion while a partner remains |
| E008 | N12 Auth hardening | Current JWT lifetime and sensitive-operation session validation | Live-setting read, issued-token/session tests and risk review | No production account deletion/transfer |
| E009 | N12 monitoring | No paid tool, approved existing capability or separately approved provider | Redaction, alert ownership, cost and failure-path test | Local/redacted diagnostics only; no public release |
| E010 | N12 distribution identity | Bundle/application IDs, signing team, store accounts and support/privacy URLs | Ownership review and explicit external approval | Local simulator/device builds only |

## Explicit non-decisions

The following are not silently decided by this architecture:

- production migration order or timing;
- production connected-planning or public-entry flag activation;
- Supabase JWT lifetime or other Auth settings;
- Apple/Google account purchase, certificates, hosted builds or store release;
- analytics/crash provider or consent language;
- supplier publication, category activation, claims migration or outreach;
- supplier pricing, paid tiers, subscriptions or billing;
- ownership-transfer versus delete-for-everyone retention policy; and
- conclusions based on unverified competitor counts, pricing or campaign claims.

Each requires the evidence and approval named in the implementation sequence.
