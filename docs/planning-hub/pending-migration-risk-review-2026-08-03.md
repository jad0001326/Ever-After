# Pending production migration risk review

Date: 3 August 2026

Status: local SQL review plus read-only production compatibility checks. No
migration, history change, data write, branch, deployment or paid resource was
created.

## Live scale checked

The existing tables touched by the pending SQL are small:

| Existing table | Rows |
| --- | ---: |
| `budget_plans` | 2 |
| `vendor_users` | 5 |
| `supplier_listings` | 31 |
| `outreach_campaigns` | 28 |
| `outreach_campaign_recipients` | 819 |

A second read-only query tested the pre-migration outreach shapes against the
new constraints. It found zero invalid campaign audiences and zero invalid
recipient references. All 819 current recipients are venue recipients; there
are no historical Photography recipients to rewrite. The migration still
retains full legacy Photography compatibility.

## File-by-file risk

| Migration | Existing-data or lock surface | Safety assessment |
| --- | --- | --- |
| Planning Workspace foundation | Creates eight new empty tables, indexes, triggers, grants, policies and protected functions. Its only existing-table dependency is the composite `budget_plans` ownership key used by a foreign key. | Additive. No existing plan is backfilled and the cloud flag stays off. Failure leaves no enabled application path. |
| Snapshot import | Adds functions and triggers to the new planning tables, then recalculates timestamps on `planning_workspaces`. | The update sees zero rows at first activation because the foundation does not backfill workspaces. Runtime replacement is transactional and member-scoped. |
| Workspace profiles | Creates one new empty table plus member policies and a versioned import function. | Additive and dormant. No existing profile or budget data is rewritten. |
| Partner budgets | Changes authenticated grants and adds partner-aware `SELECT`/`UPDATE` policies on `budget_plans`. | Highest functional-risk step because it changes access to an existing table, but only two rows currently exist. Existing owner policies remain, the new helper is membership-bound, column grants exclude ownership fields, and embedded owner/partner/outsider tests pass. Keep the cloud flag off until real Data API verification. |
| Table-plan sync | Adds a transaction-safe function over the new planning tables. | No migration-time data change. Destructive statements exist only inside the callable replacement function and are scoped to one authorised workspace. |
| Supplier owner requests | Creates a new empty review table and adds bounded owner-read policies to existing supplier membership/listing tables. | No supplier listing is changed at migration time. Five membership and 31 listing rows are within a trivial policy-validation surface; direct owner publication remains denied by tests. |
| Supplier catalogue staging | Creates two new empty admin-only staging tables, indexes and review functions. | Additive. No candidate is imported and accepted records can create drafts only when the function is later invoked. |
| Data API grant hardening | Revokes only `TRUNCATE`, `TRIGGER` and `REFERENCES` from browser-facing roles on 19 legacy tables. | Intentional security tightening. Application CRUD privileges are unchanged and the dedicated verifier proves the contract. |
| Generic supplier outreach | Adds two nullable category foreign keys, replaces audience/reference checks and adds two partial indexes. | Existing-table scan is bounded by 28 campaigns and 819 recipients. Read-only live checks prove every current row satisfies the replacement constraints. No row is rewritten; the category UI and sending each remain off. |

## Destructive-statement interpretation

No pending migration contains `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` or an
unscoped migration-time `DELETE`. The snapshot-import and table-plan files do
contain `DELETE` statements inside functions, where they implement an atomic,
authorised replacement of one workspace after activation; those statements do
not execute while the migration is applied.

Constraint drops in the outreach migration replace only the two existing check
contracts in the same migration. They do not drop data or foreign keys. The
replacement accepts all existing venue and Photography shapes plus the new
category-aware supplier shape.

## Operational conclusion

At the measured scale, data scanning and index creation are small. The release
should still run during a quiet window and use the fail-closed CLI dry run in
`production-activation-runbook.md`. A lock timeout, unexpected pending file,
advisor regression or post-migration privilege mismatch is a stop condition,
not a reason to broaden the command or repair history.

The dry run and approved command must use `--include-all`: the reviewed
workspace foundation migration predates production's latest recorded version.
The exact 25-entry history verifier and nine-file dry run constrain that option;
seed data and custom roles remain excluded.

The practical rollback remains application-level: keep all feature flags off
or redeploy the prior application commit. The additive schema should remain in
place while a defect is investigated. Destructive rollback and migration-
history editing require a separate checkpoint and approval.
