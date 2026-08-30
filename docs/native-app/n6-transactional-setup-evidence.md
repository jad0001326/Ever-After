# N6 transactional setup migration evidence

Date: 26 August 2026; production verification updated 30 August 2026

Status: applied and verified in production under explicit approval. This
document does not authorise replaying the migration, changing production data,
altering a feature flag, deploying application code, outreach or a paid service.

## Applied production boundary

- Production history is the confirmed 41/41 applied set ending at
  `20260826144100_n6_transactional_workspace_setup.sql`.
- Raw-file SHA-256:
  `03feab7705108c9f6856c678f9533ddbae498b3fd6977199610e11d649245d50`.
- The file was generated locally with Supabase CLI `2.115.0` using
  `migration new`; its timestamp was not invented manually.

## Additive boundary

The migration adds one `SECURITY INVOKER` function and no table, column,
extension, role, seed, trigger, policy, supplier, catalogue, outreach or data
mutation. Existing Planning Workspace and budget RLS remains the authorization
boundary.

`update_planning_workspace_setup_v1`:

- requires an authenticated caller;
- validates bounded budget and complete profile values;
- locks workspace, linked budget and profile in that fixed order;
- checks all three caller-supplied versions before writing;
- updates budget columns and JSON compatibility mirrors together;
- inserts or updates the complete wedding profile in the same transaction;
- returns the canonical workspace, budget and profile versions;
- exposes stale writes as SQLSTATE `P4090`; and
- revokes execution from `PUBLIC`, `anon` and `service_role`, granting only
  `authenticated`.

## Local evidence

- The PGlite planning security harness applies the migration after the exact
  existing Planning Workspace chain.
- Owner and partner atomic setup updates pass.
- Outsider access is denied by live RLS visibility.
- Anonymous execution remains denied.
- Stale workspace/budget/profile versions return `P4090` and preserve the
  accepted budget.
- Budget columns, budget JSON date/guest/location mirrors and the complete
  profile converge on the canonical response versions.
- The database TypeScript surface contains the generated RPC shape.
- Full TypeScript checking passes.
- Production alignment reports 41 canonical applied versions and zero pending
  migrations.
- The linked dry run immediately before application listed only this migration,
  with no seed, role or Vault changes.
- The post-application ledger reported exact 41/41 alignment.
- Live catalogue inspection confirmed `SECURITY INVOKER`, an empty search path,
  `authenticated` execute access and no `anon` or `service_role` execute access.
- Controlled anonymous, service-role and unauthenticated-caller checks passed
  inside transactions that were fully rolled back.

## Completed release gates

1. The complete local Planning Workspace RLS harness passes.
2. The pinned CLI help, linked migration list and exact one-file dry run were
   checked immediately before the approved application.
3. The approved application completed without seeds, roles or Vault changes.
4. The post-application ledger and controlled production security checks pass.
5. Application-code merge and deployment remain separate release actions.
