# Planning Dashboard native API

Date: 29 July 2026

Status: implemented and verified locally, but dormant. The route is not live
and returns `503 connected_planning_disabled` before authentication unless
`PLANNING_WORKSPACE_CLOUD_ENABLED=true`.

## Contract

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

## Authentication and authorization

The endpoint accepts a Supabase Auth access token, not an API key. It:

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

## Failure contract

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_workspace_id` | The path does not contain a valid workspace UUID. |
| 401 | `authentication_required` | A bearer token is missing, malformed, expired or rejected by Supabase Auth. |
| 404 | `workspace_unavailable` | The caller cannot read the workspace, or it does not exist. |
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

This proves the built route fails closed without contacting Supabase. A `200`
response still requires the separately gated local full-stack Auth/Data API
run described in `api-verification.md`.

## Activation boundary

Do not enable the route in production merely because its code and database RLS
tests pass. First run the prepared local Auth/Data API scenario, call this
endpoint with owner, partner, outsider and expired tokens, and confirm the
response against the checked JSON Schema. Production activation, migration
application and cloud-flag changes each still require explicit approval.
