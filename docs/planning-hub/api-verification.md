# Planning workspace Auth and Data API verification

Date: 9 August 2026

Status: direct Data API and checked Next.js route verifier prepared and
fail-closed; not executed because this machine does not have a container
runtime for the full local Supabase stack.

## Purpose

`npm run test:planning-api` exercises the security boundary that embedded
PostgreSQL cannot emulate:

- GoTrue user creation, confirmed email and password sign-in;
- publishable-key and authenticated `supabase-js` requests through PostgREST;
- explicit Data API grants and RLS behavior;
- owner snapshot import and automatic owner membership;
- email-bound, single-use partner invitation acceptance;
- partner workspace, task and linked-budget access, with denial for unlinked
  owner budgets and workspace budget relinking;
- owner-only invitation, membership and workspace deletion controls;
- outsider and anonymous isolation; and
- table-plan version conflict behavior through the public RPC.

After those direct Data API assertions pass, the same owner, partner and
outsider sessions plus a deliberately rejected bearer call
`GET /api/planning/v1/workspaces`:

- prove owner and partner receive the expected bounded collection and their
  own role without owner IDs or other membership rows;
- prove pagination and most-recently-updated ordering;
- prove outsider and rejected-bearer requests receive an empty collection or
  authentication denial as appropriate; and
- validate successful responses against the checked workspace collection
  schema.

Then the same owner, partner, outsider and rejected-bearer cases call
`GET /api/planning/v1/workspaces/{workspaceId}/dashboard`. Owner and partner
responses must validate against the checked v1 JSON Schema; outsider and
rejected tokens must receive the route's generic denial contract. See
`native-dashboard-api.md`.

Then use the dashboard's `budgetUpdatedAt` value with
`PATCH /api/planning/v1/workspaces/{workspaceId}/budget`:

- prove owner and partner can update only the linked budget;
- prove a stale version returns `409 version_conflict` without changing data;
- prove an outsider receives the generic workspace denial;
- prove the stored `user_id` remains the workspace owner even when a partner
  writes; and
- validate the success body and subsequent GET against the checked schemas.

Use the same dashboard's `workspaceUpdatedAt` value with
`PATCH /api/planning/v1/workspaces/{workspaceId}/table-plan`:

- first load `GET /table-plan` as owner and partner and validate the complete
  resource against its checked schema;
- prove the resource's `workspaceUpdatedAt` is accepted by PATCH;
- prove owner and partner can atomically replace guests, tables, seats and
  seating rules through their caller-bound session;
- prove a stale workspace version returns `409 version_conflict` without
  partially replacing any table-plan record;
- prove an outsider receives the generic workspace denial; and
- prove impossible stored seating fails the resource contract instead of
  returning partially trusted data; and
- validate the success body and subsequent dashboard GET against the checked
  schemas.

Then exercise both methods on
`/api/planning/v1/workspaces/{workspaceId}/profile`:

- prove owner and partner receive the same strict profile resource;
- prove an accessible workspace without a profile returns `profile: null`;
- create that missing profile with `expectedProfileUpdatedAt: null`;
- update it using the exact returned `profile.updatedAt`;
- prove a stale version returns `409 version_conflict` without changing the
  stored profile;
- prove an outsider receives the generic workspace denial; and
- validate every successful response against the checked resource schema.

Finally exercise the task collection and item resources:

- prove owner and partner receive the same bounded, ordered task page;
- create with both a server-generated and stable client-generated task ID;
- prove the same stable ID cannot be inserted twice;
- update and delete using each task's exact `updatedAt`;
- prove stale and post-read-race versions return `409 version_conflict`
  without changing or deleting the newer task;
- prove a task ID from another workspace is never resolved through the current
  workspace path;
- prove outsider calls receive the generic workspace denial; and
- validate collection, resource and delete responses against checked schemas.

All application assertions use publishable-key clients with real user sessions.
The secret test key is used only to create test Auth users, confirm their
profiles exist and delete those users during cleanup.

## Safety boundary

The verifier requires dedicated variables; it does not fall back to the
application's normal Supabase variables:

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_PUBLISHABLE_KEY`
- `SUPABASE_TEST_SECRET_KEY`
- `PLANNING_API_TEST_APP_URL`

Loopback hosts (`127.0.0.1`, `localhost` and `::1`) are accepted by default.
Every remote URL is refused before a client is created.

The application URL must be an origin-only loopback URL by default. For an
explicitly approved EverAft production smoke, the only permitted deployed
origin is `https://www.everaft.co.uk`.

A remote disposable project can only be selected after separate approval by
setting both:

- `PLANNING_API_TEST_ALLOW_REMOTE=true`
- `PLANNING_API_TEST_CONFIRM_REMOTE_HOST` to the URL's exact host

That override is an additional guard, not approval. The EverAft production
project requires its own three exact locks after a separate test-data approval:

- `PLANNING_API_TEST_ALLOW_PRODUCTION=true`
- `PLANNING_API_TEST_CONFIRM_PRODUCTION_PROJECT=fryfdniacyhpubfiqnxj`
- `PLANNING_API_TEST_CONFIRM_CLEANUP=delete-temporary-users-and-cascaded-planning-data`

The verifier creates temporary Auth users and planning records, exercises the
atomic import and rollback paths, then deletes the users and verifies their
absence through the Auth Admin API. The release ledger separately verifies
that profiles, budgets, workspaces and child records were cascaded away.

## Local-stack precondition

The target must already contain the EverAft baseline schema and all Planning
Hub migrations verified by `npm run test:planning-rls`.

The repository's migration folder contains incremental changes rather than the
original application baseline. `supabase/schema.sql` contains that baseline.
Do not run `supabase start` or `supabase db reset` directly in this checkout.

Generate a disposable local-only project instead:

```powershell
npm.cmd run planning-api:prepare-local
```

The generator:

1. checks that the baseline has not begun overlapping later table migrations;
2. copies `schema.sql` byte-for-byte as the first test migration;
3. copies all 38 timestamped migrations byte-for-byte in filename order;
4. records a SHA-256 checksum for every source and target; and
5. refuses to replace an existing output directory.

It writes to a unique operating-system temporary directory by default and
prints that path. The generated manifest is test-only. It does not alter or
repair repository or production migration history.

## Local command

Inside the generated directory, let the installed CLI create its own
version-matched config and start the stack:

```powershell
supabase init --workdir .
supabase start --workdir .
```

After all 39 generated migrations apply, start the EverAft application from a
second terminal with the cloud gate enabled only in that process:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '<local publishable key>'
$env:PLANNING_WORKSPACE_CLOUD_ENABLED = 'true'
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

Then use a third terminal to run the verifier with the URL and keys printed by
`supabase start`:

```powershell
$env:SUPABASE_TEST_URL = 'http://127.0.0.1:54321'
$env:SUPABASE_TEST_PUBLISHABLE_KEY = '<local publishable key>'
$env:SUPABASE_TEST_SECRET_KEY = '<local secret key>'
$env:PLANNING_API_TEST_APP_URL = 'http://127.0.0.1:3000'
npm.cmd run test:planning-api
```

The command first proves that the loopback app has the connected-planning gate
enabled and rejects an unsigned request. It then validates every successful
response against the checked Draft 2020-12 contract, verifies the contract and
private/no-store security headers, and covers owner, partner, outsider,
rejected-bearer and version-conflict behavior across workspace discovery,
dashboard, budget, table-plan, profile and task routes. It prints only the
target class (`local loopback`, `approved disposable` or explicitly approved
EverAft production) and assertion progress. It never prints keys, passwords,
access tokens or invitation tokens.

The generator and checksum verification pass on this machine, including the
hardened workspace-foundation and atomic-import migrations. A real target run
must also confirm that Auth's `handle_new_user` trigger creates
`public.profiles`.

## Cleanup

All generated emails include a unique `everaft-planning-<role>-<run>` marker.
Cleanup deletes created Auth users in reverse order, verifies their absence
through the Auth Admin API and relies on the baseline foreign-key cascade to
remove profiles, budgets, workspaces and child records. Cleanup failure is
treated as test failure and reports only affected user IDs. Production release
evidence must additionally compare aggregate data counts before and after.

Production execution remains a controlled release action: use only the exact
approval locks above, verify cleanup, and compare the before/after production
counts recorded in the activation release evidence.
