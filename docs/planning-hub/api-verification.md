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
- partner workspace, task and linked-budget access;
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

The repository currently has no `supabase/config.toml`, and its migration folder
contains incremental changes rather than the original application baseline.
`supabase/schema.sql` contains that baseline. Do not assume that running
`supabase start` or `supabase db reset` directly in this checkout will produce a
valid database. First create and review a reproducible local bootstrap that:

1. initializes a local Supabase project;
2. applies the baseline schema without writing to a hosted project;
3. applies later repository SQL in its established order;
4. applies the eight Planning Hub migrations in timestamp order; and
5. confirms Auth's `handle_new_user` trigger creates `public.profiles`.

That bootstrap must be tested on a disposable local database before it becomes
repository migration history. It must not repair or rewrite production
migration history by assumption.

## Local command

After a full local stack is prepared, use the URL and keys printed by
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

## Cleanup

All generated emails include a unique `everaft-planning-<role>-<run>` marker.
Cleanup deletes created Auth users in reverse order, relying on the baseline
foreign-key cascade to remove profiles, budgets, workspaces and child records.
Cleanup failure is treated as test failure and reports only affected user IDs.

No API verification has run against EverAft production, and no paid resource,
cloud branch, migration, deployment or production write was used to prepare
this harness.
