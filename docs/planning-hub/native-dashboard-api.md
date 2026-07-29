# Planning Hub native API

Date: 29 July 2026

Status: dashboard read, wedding-profile and task management, plus conflict-safe
budget and table-plan writes are implemented and verified locally, but dormant.
None of the routes is live. They return `503 connected_planning_disabled` before authentication unless
`PLANNING_WORKSPACE_CLOUD_ENABLED=true`.

## Dashboard read contract

```http
GET /api/planning/v1/workspaces/{workspaceId}/dashboard
Authorization: Bearer {supabase-access-token}
```

A successful response is the strict
`urn:everaft:planning-dashboard-snapshot:v1` contract checked in at
`docs/planning-hub/contracts/planning-dashboard-snapshot.v1.schema.json`.
It contains the connected budget summary, payment deadlines, task and guest
readiness, profile completion, platform-neutral next recommendation and
separate workspace/budget version timestamps for future conflict-safe writes.

Every response is private and `no-store`, varies on `Authorization`, carries
`X-Content-Type-Options: nosniff` and identifies the contract through
`X-EverAft-Contract`.

## Budget write contract

```http
PATCH /api/planning/v1/workspaces/{workspaceId}/budget
Authorization: Bearer {supabase-access-token}
Content-Type: application/json

{
  "schemaVersion": 1,
  "expectedBudgetUpdatedAt": "2026-07-29T12:00:00.000Z",
  "plan": { "...": "the complete validated budget plan" }
}
```

The checked request and success schemas are:

- `contracts/planning-budget-update-request.v1.schema.json`
- `contracts/planning-budget-update-success.v1.schema.json`

The request version must equal `plan.updatedAt` and the version returned by the
latest dashboard GET. The route first compares it with the currently loaded
RLS-visible budget, then applies an update filtered by the same exact
`updated_at`. A stale read and a race after that read both return
`409 version_conflict`; neither silently overwrites the newer plan.

The plan ID must remain the workspace's linked budget ID. The server ignores a
caller-supplied plan owner, stores the workspace owner ID and updates only the
six columns explicitly granted to authenticated workspace members. Payloads
are capped at 1 MB before JSON validation. A success contains only the plan ID
and new server version:

```json
{
  "schemaVersion": 1,
  "budgetPlanId": "budget-1",
  "savedAt": "2026-07-29T12:00:00.001Z"
}
```

## Authentication and authorization

The API accepts a Supabase Auth access token, not an API key. It:

1. rejects missing, malformed and oversized bearer values;
2. verifies the token through `supabase.auth.getUser(token)`;
3. creates one request-scoped client with the publishable key and that exact
   access token;
4. performs every required workspace, profile, task, guest, table, seat, rule
   and linked-budget query through that caller-bound client, while omitting
   unused membership and invitation reads; and
5. relies on the existing explicit grants and RLS policies for owner/partner
   access and outsider denial.

No service-role or secret key is read. The route does not accept a caller-
supplied owner ID and never uses user metadata for authorization. An
RLS-inaccessible or nonexistent workspace produces the same generic
`404 workspace_unavailable` response.

## Wedding-profile resource

```http
GET /api/planning/v1/workspaces/{workspaceId}/profile
Authorization: Bearer {supabase-access-token}
```

```http
PATCH /api/planning/v1/workspaces/{workspaceId}/profile
Authorization: Bearer {supabase-access-token}
Content-Type: application/json

{
  "schemaVersion": 1,
  "expectedProfileUpdatedAt": "2026-07-29T12:00:00.000Z",
  "profile": { "...": "the complete profile without a client timestamp" }
}
```

The checked resource and request schemas are:

- `contracts/planning-profile-resource.v1.schema.json`
- `contracts/planning-profile-update-request.v1.schema.json`

GET returns the full wedding profile or `null` when the caller can access a
workspace that has not established one. PATCH uses `null` as the expected
version only for first creation; existing profiles require the exact
`profile.updatedAt` returned by GET. The route prechecks that version and then
conditions the update on the same `updated_at`. A concurrent first insert or
update produces `409 version_conflict`.

The client cannot supply `updatedAt`, workspace ownership or any database
identity field. PostgreSQL supplies the creation time and the existing update
trigger supplies later versions. Both reads and writes use only the caller's
publishable-key client, explicit authenticated grants and the existing
owner/partner RLS policies. No migration or privileged function was added.

## Task collection and item resources

```http
GET  /api/planning/v1/workspaces/{workspaceId}/tasks?limit=50&offset=0
POST /api/planning/v1/workspaces/{workspaceId}/tasks
PATCH /api/planning/v1/workspaces/{workspaceId}/tasks/{taskId}
DELETE /api/planning/v1/workspaces/{workspaceId}/tasks/{taskId}
Authorization: Bearer {supabase-access-token}
```

Six checked schemas define the task resource, bounded collection, create
request, exact-version update, exact-version delete and delete confirmation:

- `contracts/planning-task-resource.v1.schema.json`
- `contracts/planning-task-collection.v1.schema.json`
- `contracts/planning-task-create-request.v1.schema.json`
- `contracts/planning-task-update-request.v1.schema.json`
- `contracts/planning-task-delete-request.v1.schema.json`
- `contracts/planning-task-delete-success.v1.schema.json`

Collection reads default to 50 records and accept a maximum page size of 100.
The persistence query requests one extra row to report `hasMore` without
returning an unbounded task list.

Create requests may include a stable client-generated UUID for offline/native
continuity, but workspace identity always comes from the authenticated path.
Updates and deletions require the exact `task.updatedAt` returned by a prior
read. Both first compare the RLS-visible task and then condition the Data API
mutation on the workspace ID, task ID and same timestamp. A stale read or
intervening write returns `409 version_conflict`.

Every lookup binds the task ID to the path workspace. A missing task in an
accessible workspace returns generic `404 task_unavailable`; an inaccessible
workspace remains `404 workspace_unavailable`. Clients cannot write workspace
IDs, creation/update timestamps or other database identity fields.

## Table-plan write contract

```http
PATCH /api/planning/v1/workspaces/{workspaceId}/table-plan
Authorization: Bearer {supabase-access-token}
Content-Type: application/json

{
  "schemaVersion": 1,
  "expectedWorkspaceUpdatedAt": "2026-07-29T12:00:00.000Z",
  "tablePlan": { "...": "the complete validated guest and seating plan" }
}
```

The checked request and success schemas are:

- `contracts/planning-table-plan-update-request.v1.schema.json`
- `contracts/planning-table-plan-update-success.v1.schema.json`

The route performs a narrow RLS-visible workspace-version read before calling
the existing `sync_planning_table_plan` database function. That function
rechecks workspace access, locks the workspace, compares the same exact
version, validates limits and atomically replaces the guest, table, seat and
seating-rule rows. A stale precheck or a race inside the transaction returns
`409 version_conflict`.

The function remains restricted to authenticated callers and preserves its
owner-or-partner workspace access check. The broader snapshot-import function
is deliberately not exposed here because its existing-workspace path is
owner-only. This route adds no migration, grant or service-role path.

## Failure contract

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_workspace_id` | The path does not contain a valid workspace UUID. |
| 400 | `invalid_request` | The PATCH JSON or its internal version relationship is invalid. |
| 400 | `invalid_pagination` | Task limit or offset is outside the bounded integer contract. |
| 400 | `invalid_task_id` | The task path does not contain a valid UUID. |
| 401 | `authentication_required` | A bearer token is missing, malformed, expired or rejected by Supabase Auth. |
| 404 | `workspace_unavailable` | The caller cannot read the workspace, or it does not exist. |
| 404 | `task_unavailable` | The task is absent from the accessible path workspace. |
| 409 | `version_conflict` | The targeted budget, table plan or profile version changed before the conditional write. |
| 413 | `payload_too_large` | The PATCH request exceeds 1 MB. |
| 415 | `unsupported_media_type` | The PATCH request is not JSON. |
| 500 | `snapshot_unavailable` | Accessible records did not form a valid matched snapshot. |
| 503 | `connected_planning_disabled` | The server-only cloud feature flag is absent. |
| 503 | `planning_api_unavailable` | Auth, configuration or the Data API is temporarily unavailable. |

Error bodies never contain tokens, database messages, table names or a
distinction between absent and inaccessible workspaces.

## Verification

Local tests cover:

- disabled-cloud short-circuit before client creation;
- workspace-ID validation before a query;
- missing, malformed, oversized, rejected and temporarily unverifiable access
  tokens;
- request-scoped publishable-key client construction with the bearer token;
- owner-budget lookup through the RLS-visible workspace owner and budget IDs;
- generic outsider denial;
- successful strict snapshot output for a partner;
- no-store and version headers;
- query and plan/workspace mismatch failure; and
- strict budget request and success schema drift;
- invalid content, oversized payload and internally inconsistent versions;
- refusal to replace the workspace's linked budget;
- server-side owner enforcement without updating `user_id`;
- exact `user_id`, plan ID and `updated_at` conditional filters;
- pre-write stale-version and post-read race conflicts;
- distinct conditional-conflict and Data API failure handling;
- strict table-plan request and success schema drift;
- invalid seating rejection before any workspace read;
- partner table-plan success through the caller-bound RPC;
- generic table-plan outsider denial;
- table-plan stale-precheck and in-transaction race conflicts; and
- strict profile resource and update-request schema drift;
- accessible missing-profile reads without confusing them with outsider denial;
- partner profile creation and exact-version replacement;
- rejection of client timestamps and unknown profile fields;
- first-insert collisions and post-read profile update races; and
- bounded task pagination with an explicit `hasMore` signal;
- strict task resource/create/update/delete contracts and generated schemas;
- workspace-bound partner task list, create, update and delete;
- stable client-ID collision handling;
- generic task/workspace denial without cross-workspace lookup;
- stale-precheck and conditional update/delete race conflicts; and
- the unchanged embedded PostgreSQL owner, partner, outsider and anonymous RLS
  scenarios.

An optimized local production server returned:

```text
HTTP 503
Cache-Control: private, no-store, max-age=0
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Authorization
X-EverAft-Contract: urn:everaft:planning-dashboard-snapshot:v1
{"error":"connected_planning_disabled"}
```

The built table-plan PATCH independently returned:

```text
HTTP 503
Cache-Control: private, no-store, max-age=0
X-EverAft-Contract: urn:everaft:planning-table-plan-update-success:v1
{"error":"connected_planning_disabled"}
```

A real owner/partner success still requires the gated full-stack verification
below.

The built profile GET independently returned:

```text
HTTP 503
Cache-Control: private, no-store, max-age=0
X-EverAft-Contract: urn:everaft:planning-profile-resource:v1
{"error":"connected_planning_disabled"}
```

The built task collection GET independently returned:

```text
HTTP 503
Cache-Control: private, no-store, max-age=0
X-EverAft-Contract: urn:everaft:planning-task-collection:v1
{"error":"connected_planning_disabled"}
```

This proves the built route fails closed without contacting Supabase. A `200`
response still requires the separately gated local full-stack Auth/Data API
run described in `api-verification.md`.

The built PATCH route independently returned:

```text
HTTP 503
Cache-Control: private, no-store, max-age=0
X-EverAft-Contract: urn:everaft:planning-budget-update-success:v1
{"error":"connected_planning_disabled"}
```

## Activation boundary

Do not enable the routes in production merely because their code and database
RLS tests pass. First run the prepared local Auth/Data API scenario, call the
dashboard, budget, table-plan, profile and task resources with owner, partner,
outsider and expired tokens, prove real stale budget, table-plan, profile and
task versions return 409 without changing data, and confirm successful
responses against the checked JSON Schemas.
Production activation, migration application and cloud-flag changes each still
require explicit approval.
