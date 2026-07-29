# Planning workspace Auth and Data API verification

Date: 28 July 2026

Status: verifier prepared and fail-closed; not executed because this machine
does not have a full local Supabase stack.

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

All application assertions use publishable-key clients with real user sessions.
The secret test key is used only to create test Auth users, confirm their
profiles exist and delete those users during cleanup.

## Safety boundary

The verifier requires dedicated variables; it does not fall back to the
application's normal Supabase variables:

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_PUBLISHABLE_KEY`
- `SUPABASE_TEST_SECRET_KEY`

Loopback hosts (`127.0.0.1`, `localhost` and `::1`) are accepted by default.
Every remote URL is refused before a client is created.

A remote disposable project can only be selected after separate approval by
setting both:

- `PLANNING_API_TEST_ALLOW_REMOTE=true`
- `PLANNING_API_TEST_CONFIRM_REMOTE_HOST` to the URL's exact host

That override is an additional guard, not approval. Never point it at the
EverAft production project. The verifier creates temporary Auth users and
planning records before deleting the users and their cascaded data.

## Local-stack precondition

The target must already contain the EverAft baseline schema and the eight
Planning Hub migrations verified by `npm run test:planning-rls`.

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
3. copies all 27 timestamped migrations byte-for-byte in filename order;
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

After all 28 generated migrations apply, use the URL and keys printed by
`supabase start`:

```powershell
$env:SUPABASE_TEST_URL = 'http://127.0.0.1:54321'
$env:SUPABASE_TEST_PUBLISHABLE_KEY = '<local publishable key>'
$env:SUPABASE_TEST_SECRET_KEY = '<local secret key>'
npm.cmd run test:planning-api
```

The command prints only the target class (`local loopback` or
`approved disposable`) and assertion progress. It never prints keys, passwords
or invitation tokens.

The generator and checksum verification pass on this machine, including the
hardened workspace-foundation migration. The stack itself has not run because
no container runtime or Supabase CLI is installed; the Windows WSL executable
is present, but the subsystem and a Linux distribution are not installed. Its
first successful run must also confirm that Auth's `handle_new_user` trigger
creates `public.profiles`.

## Cleanup

All generated emails include a unique `everaft-planning-<role>-<run>` marker.
Cleanup deletes created Auth users in reverse order, relying on the baseline
foreign-key cascade to remove profiles, budgets, workspaces and child records.
Cleanup failure is treated as test failure and reports only affected user IDs.

No API verification has run against EverAft production, and no paid resource,
cloud branch, migration, deployment or production write was used to prepare
this harness.
