# N6 transactional setup migration evidence

Date: 26 August 2026

Status: local candidate only. Nothing in this document authorises a push,
Supabase dry run against a linked project, migration application, production
data change, feature-flag change, deployment, outreach action or paid service.

## Baseline and candidate

- Production history remains the confirmed 40/40 applied set ending at
  `20260822141612_atomic_supplier_claim_review`.
- The only local pending migration is
  `20260826144100_n6_transactional_workspace_setup.sql`.
- Raw-file SHA-256:
  `03feab7705108c9f6856c678f9533ddbae498b3fd6977199610e11d649245d50`.
- The file was generated locally with Supabase CLI `2.115.0` using
  `migration new`; its timestamp was not invented manually.

## Additive boundary

The candidate adds one `SECURITY INVOKER` function and no table, column,
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

- The PGlite planning security harness applies the candidate after the exact
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
- Production alignment reports 40 canonical applied versions plus exactly this
  one reviewed pending candidate.

## Still required before a migration PR or remote proposal

1. Run the complete repository test suite and SQL diff checks.
2. Apply the 40+1 chain to a fresh local Supabase stack and exercise the real
   Auth/Data API with separate owner, partner and outsider sessions.
3. Verify `db push --help` for the pinned CLI, then run a read-only linked
   migration list and dry run showing only this candidate.
4. Review database security/performance advisors and lock duration locally.
5. Prepare forward correction and emergency execute-revocation SQL.
6. Obtain separate approval before pushing the branch or applying the named
   migration anywhere remotely.
