# Planning workspace RLS verification

Date: 28 July 2026

## Run it

```powershell
npm.cmd run test:planning-rls
```

The command is also part of `npm test`.

## What runs

The verifier uses pinned `@electric-sql/pglite` 0.5.4 to run PostgreSQL entirely
in memory. It loads `pgcrypto`, creates a minimal Supabase-compatible test
foundation, and executes these repository migrations unchanged:

1. budget plan table;
2. budget plan grants;
3. user-scoped budget keys;
4. connected workspace foundation;
5. snapshot import;
6. wedding profile;
7. partner budget access; and
8. table-plan synchronization.

Before exercising user journeys, it inspects the PostgreSQL catalogs and fails
if a planning table lacks RLS, `anon` has table privileges, a required command
policy is missing, or a sensitive function has unsafe execution grants,
search-path configuration or invoker/definer mode.

The transaction scenario then covers owners, partners, outsiders, matching and
non-matching invitees, unconfirmed email, anonymous access, linked budgets,
tasks, private guest data, tables, seats, profiles, invitations, snapshot
imports and optimistic-concurrency failures. Synthetic records always roll
back.

## Defect found by execution

The original profile import used:

```sql
on conflict (workspace_id) do update
```

Its `returns table` declaration also creates a PL/pgSQL output variable named
`workspace_id`, making the reference ambiguous at runtime. The dormant
migration now targets:

```sql
on conflict on constraint planning_workspace_profiles_pkey do update
```

The unchanged RLS scenario passes after that correction.

## Boundary of the proof

PGlite is PostgreSQL, so this test exercises real roles, grants, RLS policies,
triggers, constraints and security-definer behavior. It deliberately does not
claim to emulate Supabase Auth, PostgREST, JWT issuance or cookie transport.

Before enabling `PLANNING_WORKSPACE_CLOUD_ENABLED`, repeat an integration smoke
test through Supabase Auth and the Data API in a free local stack or an approved
disposable environment. No paid branch is required.

No production data, production migration, cloud branch or deployment is used by
this verifier.
