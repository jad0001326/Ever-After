# Native app architecture

Date: 20 August 2026

## Decision

Build one Expo/React Native TypeScript application for iOS and Android inside
the existing repository. Keep the current Next.js application at the repository
root during the MVP. Introduce npm workspaces incrementally so the native app
and web app consume shared planning packages without a risky web-directory
move.

Proposed repository shape after the first implementation slices:

```text
ever-after/
├── src/                         existing Next.js application
├── apps/
│   └── mobile/                  Expo/React Native client
├── packages/
│   ├── planning-domain/         platform-neutral rules and value types
│   ├── planning-contracts/      DTO schemas and generated JSON Schemas
│   └── api-client/              bearer-authenticated EverAft API adapter
└── docs/native-app/             this plan
```

Expo currently supports workspace monorepos and automatic Metro configuration.
The implementation must still pin the chosen Expo SDK and every new package in
the lockfile; `latest` is not an acceptable native release dependency policy.

Official references:

- [Expo monorepos](https://docs.expo.dev/guides/monorepos/)
- [Expo Router authentication](https://docs.expo.dev/router/advanced/authentication/)
- [Supabase Auth with React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Supabase mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase sign-out behavior](https://supabase.com/docs/guides/auth/signout)
- [Expo authentication storage](https://docs.expo.dev/guides/authentication/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)

## Workspace integration with the current repository

Current main is one private npm package with a lockfile-version-3
`package-lock.json`. The Next.js application, build scripts and Vercel project
all run from the repository root. The native change must preserve that root;
it is not a migration to an `apps/web` monorepo.

N1 should add only these root workspaces:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

The shared packages use private names such as `@everaft/planning-domain`, expose
TypeScript source through explicit package exports and declare only the runtime
dependencies they actually use. New dependency versions are exact and recorded
by `npm install` in the single root lockfile. N1 must not combine this with a
broad cleanup of the existing web dependency ranges.

The current root `tsconfig.json` includes `**/*.ts` and `**/*.tsx`. Before native
source lands, it must exclude `apps/mobile` from the web typecheck. The mobile
app and each shared package own their own TypeScript configuration and
`typecheck` script. Shared sources imported by the web remain checked through
the web graph as well as their package check.

The current Next configuration should explicitly list the shared workspace
packages in `transpilePackages` when the web begins importing their TypeScript
source. Expo owns its Metro configuration and must resolve the same single
React installation; shared domain packages cannot depend on React. Native
packages that need React declare it as a peer dependency to avoid a second
runtime copy.

Root command ownership after N2:

| Command | Responsibility |
| --- | --- |
| `npm run build` | Existing root Next.js production build, unchanged for Vercel |
| `npm run typecheck` | Existing web/server graph plus imported shared packages |
| `npm run typecheck:packages` | Every shared package directly |
| `npm run typecheck:mobile` | Expo application only |
| `npm run lint` | Aggregate web, package and mobile lint jobs with environment-specific configs |
| `npm run test:unit:web` | Existing Next/jsdom Vitest suite, excluding mobile tests |
| `npm run test:packages` | Shared-domain and contract tests in a Node-compatible environment |
| `npm run test:mobile` | React Native component/repository tests in their mobile environment |
| `npm test` | Aggregate all three unit suites, then preserve the existing database/migration verifiers |

Vercel must continue to install from and build the root package. No project root
directory, production command or output directory changes are needed for the
native scaffold. The PR proves this with the same production build command used
before workspaces were introduced.

The current root ESLint configuration contains only Next core-web-vitals, and
the root Vitest configuration applies jsdom to every discovered test. N2 must
therefore give mobile its own lint/test configuration and explicitly exclude
mobile tests from the web runner. Package tests need their own environment as
well. `npm test` remains the authoritative aggregate gate; separate configs are
isolation, not permission to omit native failures from CI.

## Architectural boundaries

```text
Native screens
    │
    ├── presentation state and accessibility adapters
    │
    ├── shared planning-domain package
    │       budgets, selections, bookings, payments, recommendations,
    │       profiles, tasks, guests, seating and validation
    │
    ├── local repository
    │       cached snapshots + mutation queue + schema version
    │
    └── EverAft API client
            │  Supabase access token in Authorization header
            ▼
        Next.js /api/planning and /api/catalogue
            │  caller-bound publishable-key Supabase client
            ▼
        Supabase Auth + RLS-protected Postgres
```

The native client may use the Supabase publishable key for Auth bootstrap, but
all planning authorization remains user-bound. It must never contain or call
with a Supabase secret/service-role key. The existing Next.js planning routes
verify access tokens and then query with the same caller token so RLS remains
authoritative.

## Shared-code extraction

The current portability verifier names 26 modules. Extract them by behavior,
not by copying them into the mobile app:

- budget types, validation, calculations, starters and listing conversion;
- venue/supplier selection and manual-entry plan mutations;
- availability, booking, payment and installment calculations;
- recommendation decisions and dashboard snapshot schemas;
- wedding-profile, workspace and task types/validation;
- guest and seating rules;
- versioned request/response schemas.

The first extraction PR must preserve existing web imports through package
exports or short-lived compatibility re-exports. It must pass the unchanged
web tests before the mobile scaffold depends on it. Web navigation, analytics,
server catalogue queries, cookies, environment reads and persistence adapters
remain outside the package.

The `planning-contracts` package exposes runtime validators and generated JSON
Schemas. Both clients consume the same versioned DTOs. Contract changes require
a new schema version when backward compatibility cannot be preserved.

### Current reuse map

The first implementation PR must start from these concrete current boundaries,
not a new parallel domain model:

| Existing source | Proven behavior to preserve | Native treatment |
| --- | --- | --- |
| `src/lib/budget/*` | Budget totals, price import, status, payments, instalments, availability and venue selection | Extract portable files; keep web compatibility exports |
| `src/lib/planning-hub/plan.ts` | Manual/listing mutations and selected-venue invariants | Shared planning-domain operation |
| `src/lib/planning-workspace/recommendations.ts` | Overdue payment/task, venue, photography, suppliers, guests and tables ordering | Shared recommendation decision; native maps targets to routes |
| `src/lib/planning-hub/supplier-search.ts` | Remaining-budget, location and selected-venue discovery context | Shared filter derivation; API receives normalized values |
| `src/lib/planning-hub/venues.ts` | Published-only search, eight-result pages, pricing options and permission-aware detail galleries | Wrap with a versioned catalogue API; do not re-query in native |
| `src/lib/planning-hub/suppliers.ts` | Published-only category search, venue connections, service areas, budget filter and approved imagery | Wrap with a versioned catalogue API |
| `src/lib/table-plan/*` | Guest and seating rules | Extract portable files before native guest/table UI |
| `src/lib/planning-workspace/*-api-schema.ts` | Runtime request/response validation and 15 generated contracts | Move into planning-contracts with unchanged fixtures |
| `src/app/api/planning/v1/**` | Caller-token authentication, workspace access and route semantics | Keep server-side and consume through the typed API client |

Not all Planning Hub modules are portable. Supabase-backed catalogue queries,
Next.js route handlers, cookie/web navigation, analytics and browser persistence
remain server or web adapters. The portability verifier is a minimum boundary,
not permission to move every file under `planning-hub` into a package.

## API strategy

The native app calls EverAft's stable HTTPS APIs rather than duplicating
PostgREST queries throughout screens. This keeps filtering, error semantics,
pagination, privacy and future rate controls consistent across clients.

### Existing dormant planning APIs

| Capability | Boundary | MVP use |
| --- | --- | --- |
| Workspace discovery | `GET /api/planning/v1/workspaces` | Choose or resume the caller's plan |
| Dashboard | `GET /api/planning/v1/workspaces/{id}/dashboard` | Today screen and sync versions |
| Budget/plan | `PATCH /api/planning/v1/workspaces/{id}/budget` | Conflict-safe full-plan update; there is currently no matching GET |
| Wedding profile | `GET/PATCH .../profile` | Date, location, guests and priorities |
| Tasks | collection and item CRUD routes | Plan checklist |
| Table plan | `GET/PATCH .../table-plan` | Guests, tables, seats and rules |

These routes stay disabled until the connected-workspace schema passes the real
Supabase Auth/Data API harness and receives separate migration and flag
approvals.

Workspace discovery is currently read-only. The existing web import action
calls `import_planning_workspace_snapshot_v2`, but there is no bearer-authenticated
HTTP route that lets a native device promote its local plan into a first cloud
workspace. That is a client blocker, not functionality the app can assume.

### Client-blocking APIs to add

| Priority | Boundary | Requirements |
| --- | --- | --- |
| P0 | `POST /api/planning/v1/workspaces/import` | Validate a complete versioned device snapshot, enforce a one-megabyte limit, call the existing transactional import as the caller and return the validated workspace snapshot; preserve `40001`/`23505` conflict semantics |
| P0 | `GET /api/planning/v1/workspaces/{id}/budget` | Return the complete validated caller-accessible budget plan and its exact update version; bounded/no-store response required for initial hydration and conflict recovery |
| P0 | `PATCH /api/planning/v1/workspaces/{id}/setup` | Transactionally update total budget and the date/guest/location mirror together with the complete wedding profile; all-or-nothing conflict response |
| P0 | `GET /api/planning/v1/workspaces/{id}/tasks/{taskId}` | Return one caller-accessible task so ambiguous create/update retries do not require scanning every task page |
| P0 | `GET /api/catalogue/v1/venues` | Existing filters, exact count, numbered page, eight lightweight results, no unbounded catalogue |
| P0 | `GET /api/catalogue/v1/venues/{id}` | Approved detail/gallery on demand; representative-image disclosure preserved |
| P0 | `GET /api/catalogue/v1/favourites` and `PUT/DELETE .../{kind}/{id}` | Bounded caller-owned venue and supplier bookmarks over the existing RLS tables; validate published targets and never use a service client |
| P0 | `GET /api/catalogue/v1/suppliers/{category}` | Live categories only, venue/location/budget context, bounded results |
| P0 | `GET /api/catalogue/v1/suppliers/{category}/{id}` | Approved detail/gallery on demand; no draft category leakage |
| P1 | Partner/member endpoints | Member status plus create/revoke/redeem invitation without cookie-only assumptions |
| P1 | `POST /api/account/v1/exports` and `GET /api/account/v1/exports/{id}` | Authenticated, expiring personal-data export with no cross-account or indefinite archive |
| P1 | `GET /api/account/v1/deletion-impact` and `DELETE /api/account/v1` | Fresh-auth, idempotent deletion with explicit shared-plan and retained-record outcomes |

The catalogue endpoints should adapt the existing server query functions. They
must not load the whole catalogue into the app or expose admin/source fields.
Search responses use immutable IDs, explicit pagination, image dimensions when
available and cache validators suitable for mobile caching.

V1 uses the current numbered-page model with exactly eight result cards rather
than inventing a cursor alongside the web implementation. Every sort ends with
immutable `id` as a deterministic tie-breaker. The response may retain exact
`total`/`totalPages` while measured catalogue size keeps exact counts cheap; if
that ceases to meet the response budget, a versioned cursor contract replaces
it rather than silently changing page semantics.

The public search contract accepts only catalogue filters. It does not accept
workspace IDs, plan-item IDs, guest names or other private planning state.
Native derives venue/location/remaining-budget filters locally and sends only
those normalized values. Public catalogue responses and authenticated bookmark
responses use separate endpoints and cache policies so one user's saved state
can never enter a shared cache.

Wedding date is planning context, not a server-side claim that a supplier is
available. The API may use venue, location and remaining budget to narrow the
catalogue; date suitability remains `not_checked` until the couple records a
real availability response for that date.

### Catalogue hardening required before API reuse

The current server functions are a strong starting point but are not yet a
native API contract:

- venue search excludes internal test slugs, while venue detail currently does
  not; detail must apply the same exclusion and return generic not-found;
- supplier helpers recognise configured categories, including dormant ones;
  every public API list/detail route must require `category.live`, not merely a
  known category slug;
- an invalid/stale venue context currently falls back to an unfiltered supplier
  result; the API must return a typed stale-context response so broad results
  are not misrepresented as venue matches;
- venue and supplier sorts need immutable-ID tie-breakers for stable pages;
- supplier `hasApprovedPhoto` currently means “has an approved or representative
  permitted hero”, and the photographer mapper drops `visualStatus`; the API
  must carry explicit `approved`, `representative` or `none` status and set
  `hasApprovedPhoto` only for approved imagery; and
- only approved gallery rows are returned. Representative heroes remain
  visibly labelled placeholders and never become an unlabeled gallery.

Card layouts reserve a fixed media aspect ratio when source dimensions are not
stored. The API must not fabricate image dimensions. Venue illustrated profiles
keep the local EverAft illustration; supplier rows without permitted imagery use
the logo/profile treatment rather than an unrelated sample photograph.

The import endpoint is the only P0 planning API allowed to create a connected
workspace. The native client must not call the import RPC directly. Its request
and response need new versioned contracts, bearer-authentication tests,
payload-size enforcement, caller-bound RLS tests and retry-safe behavior. A
handled timeout may be ambiguous, so retry must use the stable local workspace
and budget IDs and return the existing cloud workspace rather than duplicate it.

### Partner-sharing boundary

The current web acceptance function has valuable invariants to preserve: a
256-bit raw token is stored only as a SHA-256 hash, acceptance requires the
authenticated account's confirmed normalized email to match, the function
checks `auth.uid()`, uses an empty search path and revokes default execution
before granting only `authenticated`. The web redemption route also removes the
raw query token into a one-hour HttpOnly, no-referrer cookie before acceptance.

Native cannot use that cookie flow. N10 adds versioned bearer-authenticated
boundaries:

| Boundary | Behavior |
| --- | --- |
| `GET /api/planning/v1/workspaces/{id}/sharing` | Owner receives current partner and invitation status; partner receives only their own membership status |
| `POST /api/planning/v1/workspaces/{id}/partner-invitations` | Owner creates one seven-day, email-bound invitation and receives the raw URL once |
| `DELETE /api/planning/v1/workspaces/{id}/partner-invitations/{inviteId}` | Owner revokes one still-unused invite; repeated revoke is an idempotent success |
| `POST /api/planning/v1/partner-invitations/accept` | Confirmed-email account submits the raw token in a no-store request body; returns the workspace and current membership |
| `DELETE /api/planning/v1/workspaces/{id}/members/{memberId}` | Owner removes the partner, never the protected owner membership |

The MVP is a couple workspace: one owner plus at most one partner. The isolated
workspace schema sequence must replace the current per-email active-invite rule
with one active invite per workspace and enforce one `role='partner'` membership
per workspace. Invite creation locks the workspace, revokes expired invitations,
rejects the owner's own email and fails if a partner or another active invite
already exists. Acceptance locks the workspace before checking/inserting the
partner so two different links cannot win concurrently.

Acceptance must be retry-idempotent. If a response is lost after the same token
was accepted by the same confirmed account, retry returns the same workspace;
it never treats a token accepted by someone else as recoverable. All invalid,
expired, wrong-email, already-filled and inaccessible cases use non-enumerating
responses.

The raw token appears only in the incoming deep link, ephemeral auth-navigation
state and the one acceptance request. If sign-in interrupts redemption, native
may keep it in secure storage for at most the same one-hour handoff window as
the web cookie, then deletes it. It never enters SQLite, analytics, crash logs,
clipboard automatically or notification content. Creating an invite opens the
OS share sheet; EverAft does not send outreach or email in this slice.

Member removal takes effect on the next server authorization check because RLS
reads membership live. A disconnected device cannot be remotely erased. On the
first `workspace_unavailable` result after reconnect, the app locks and deletes
that workspace's decrypted cache and pending operations. The removal UI states
this limitation honestly; a time-limited offline lease for partner caches can
be evaluated before public release if the privacy review requires it.

### Account export and deletion boundary

The current application has no self-service export or account-deletion path.
N12 adds one shared web/native server boundary; the mobile app must not call
`auth.admin` or delete public rows directly. The service-role key remains only
inside that narrow server implementation.

`POST /api/account/v1/exports` creates an export for the authenticated caller.
It contains their profile and Auth identity summary, favourites, enquiries,
claims/vendor relationships, owned workspaces and the caller-accessible shared
workspace data needed to understand their account. Each workspace is labelled
with the caller's role. It excludes password/session secrets, raw invite
tokens, internal review evidence, other users' Auth details and unrelated
catalogue rows. The response is either a bounded no-store download or a
short-lived, single-account job whose artifact is encrypted, access checked on
every read and automatically deleted on a documented deadline. Export failure
must not partially delete anything.

`GET /api/account/v1/deletion-impact` is a read-only preflight. It reports owned
plans, partner/shared-plan consequences, pending unsynced-device guidance,
supplier/vendor responsibilities that require transfer or review, Storage
objects and records governed by an approved retention rule. Counts are scoped
to the authenticated caller and never reveal another account's identity.

`DELETE /api/account/v1` requires a recently re-established session suitable
for the account's sign-in method, an idempotency key and explicit confirmation
of the current impact version. It never accepts an arbitrary target user ID.
An owner with a connected partner cannot accidentally cascade-delete the
shared plan: public release must either ship an atomic ownership-transfer flow
or require the owner to remove the partner and separately confirm that the
plan will be deleted for everyone. Transfer, if implemented, must atomically
reassign the workspace, owner membership and owner-scoped budget plan while
preserving all workspace child rows and testing competing deletion/sync calls.

The present schema is not deletion-ready. Removing `auth.users` cascades
through `profiles`; that currently cascades owned workspaces, budget plans,
favourites and several user submissions. Conversely,
`enrichment_contact_verification_log.verified_by` and
`supplier_catalogue_staging.created_by` use `ON DELETE RESTRICT`, so accounts
referenced there may fail to delete. User-owned Supabase Storage objects can
also block Auth deletion and must be removed through the Storage API, never by
deleting `storage.objects` rows with SQL. N12 therefore requires a reviewed
data inventory and retention decision before writing its migration or handler:
each relation must be deliberately deleted, transferred, anonymised or retained
with a lawful non-identifying audit key.

The server deletion sequence is fail-closed and retryable: re-check fresh
authentication and impact version, lock/mark the account operation, resolve
the approved database and Storage actions, revoke sessions/delete the Auth
user, then return a terminal receipt that contains no personal data. A failed
step returns a recoverable pending/failed state and never reports success while
the account can still refresh a session. Because already-issued access-token
JWTs remain usable until expiry, sensitive deletion/transfer operations validate
the `session_id` against live Auth sessions, and the release review considers a
shorter JWT lifetime as a separate production-setting decision. After success,
the client immediately stops sending tokens and erases all local keys, caches,
exports and queued mutations.

The dashboard contract is deliberately an aggregate and cannot hydrate the
budget editor. The new budget GET must reuse the same validation and ownership
path as PATCH, return the full plan with its canonical server `updatedAt`, and
apply the same body-size ceiling used for imports. It is not an excuse to place
the plan in the dashboard response.

### Wedding-basics source of truth

Date, guest count and location currently exist in both the budget-plan JSON and
`planning_workspace_profiles`. The profile is the connected-workspace source of
truth; the budget copies remain compatibility mirrors because existing budget
calculations, availability and device-only plans consume them. Total budget
remains owned by the budget plan.

The current web Organise screen attempts to save the budget mirror and profile
with two parallel server actions. That is not atomic: one write can succeed
while the other fails. Native must not reproduce it. The setup endpoint needs a
new `SECURITY INVOKER` database function in the isolated workspace schema
sequence that:

1. verifies caller access through existing RLS;
2. locks the linked budget row and profile row in a deterministic order;
3. checks the expected budget and profile versions;
4. validates and updates total budget plus mirrored date/guest/location in the
   budget JSON;
5. upserts the complete profile; and
6. returns both canonical versions from one transaction.

Any conflict or validation failure rolls back both writes. The HTTP contract
returns the canonical profile and budget versions, and both native and the
connected web screen must converge on this boundary before cloud activation.
The function receives no arbitrary owner ID, remains caller/RLS-bound, has an
empty safe search path and grants execute only to `authenticated` after the
default `PUBLIC` privilege is revoked.

## Decision-state model

Discovery actions have distinct meanings and must not be blurred in native UI:

| State | Meaning | Storage |
| --- | --- | --- |
| Saved | A low-commitment catalogue bookmark; no budget effect | Existing `favourites` or `supplier_favourites` table when connected; mirrored locally for offline display |
| Compared | Up to three current options displayed side by side | Device repository only for MVP; no budget effect |
| Shortlisted | A real planning option with optional estimate or quote | Budget-plan item with `bookingStatus='shortlisted'` |
| Selected venue | The venue currently driving the plan | Shortlisted/quoted/booked venue item plus `selectedVenueId` |
| Quoted/booked | A supplier commitment state | Budget-plan item with matching booking/cost state, payments and availability |

The web Planning Hub currently keeps compare sets only in component memory;
native may persist them on the device so app restarts do not discard the
couple's immediate decision. That local compare set must never be presented as
a cloud-synced shortlist. Supplier bookmarks can reuse the already-deployed
`supplier_favourites` table through the new authenticated API rather than a
schema change.

## Authentication and session handling

1. Authenticate with Supabase Auth using the publishable project key.
2. Store refresh/session material through an EverAft storage adapter that never
   writes plaintext tokens to AsyncStorage or the planning database; never log
   tokens or include them in analytics.
3. Send the current access token to EverAft APIs as a bearer token.
4. Treat `401` as an authentication transition and `503
   connected_planning_disabled` as a product availability state, not a reason
   to bypass the API.
5. Use protected navigation so unauthenticated deep links return to their
   intended screen after successful sign-in.
6. Keep invitation tokens out of ordinary logs, crash reports and analytics.

The current Supabase React Native quickstart uses `processLock`, persistent
storage, `detectSessionInUrl: false`, and starts/stops automatic refresh as the
app enters/leaves the foreground. N3 preserves those lifecycle semantics and
registers the AppState/auth listeners exactly once.

The quickstart's AsyncStorage example is not EverAft's final token-at-rest
policy. Expo SecureStore encrypts small values but warns that underlying
platforms may reject large payloads. N3 must choose and prove one adapter on
physical iOS and Android devices:

- store the complete session in SecureStore only if maximum realistic EverAft
  session fixtures, rotation and recovery pass on both platforms; or
- store a small random encryption key in SecureStore and an authenticated-
  encrypted session envelope in dedicated local storage.

The second design must use a pinned, reviewed authenticated-encryption
implementation, versioned envelopes, random nonces and key deletion on logout.
Encryption without integrity protection is not acceptable. Biometric-gated
SecureStore access is not the default because background/foreground token
refresh must not unexpectedly prompt or fail; a later app-lock feature is a
separate product decision.

Expo documents that SecureStore data normally disappears on Android uninstall
but may survive an iOS uninstall/reinstall with the same bundle ID. EverAft must
not unexpectedly restore a previous account after reinstall. Store a
non-secret installation marker outside Keychain/SecureStore; if it is absent on
first launch, delete any surviving session/key material before auth restoration.
Keep SecureStore excluded from Android backup and test device transfer/restore
behavior. If EverAft ships its own encrypted envelope, record the resulting
Apple export-compliance decision in N12.

On startup, the client restores the session, validates current claims, and
keeps private navigation covered until auth resolution finishes. JWT claims
may identify the session, but user-editable metadata never authorizes workspace
or admin access. Every API request remains subject to server authentication and
RLS.

User-facing session actions are distinct:

- `Sign out of this device` uses local-session sign-out, then removes that
  user's decrypted cache, compare sets and queued operations after resolving or
  explicitly discarding unsynced work.
- `Sign out everywhere` uses global sign-out and shows that already-issued
  access tokens can remain valid until expiry.
- account deletion uses the impact-versioned server workflow above; it first
  reauthenticates, resolves unsynced work and any shared-plan decision, then
  applies the approved retention policy and clears local keys and caches.

The API client must stop sending a cached token immediately after any local
sign-out, even though remote JWT expiry is not instantaneous.

Email confirmation, password reset and partner invitations require universal
links/app links with an HTTPS web fallback. The existing web redemption flow
remains available during rollout.

Production auth links use verified Universal Links/App Links as the primary
route; a custom app scheme is limited to development or a controlled fallback.
Supabase redirect allowlists use exact EverAft callback paths. Auth callbacks
use PKCE where supported, accept only the expected scheme/host/path and discard
tokens from navigation state after exchange. Password-reset and invitation
links are handled by separate routes so one token type can never be consumed by
the other handler.

## Local-first and synchronization model

The first installed app must remain useful before cloud activation and during
temporary network loss.

### Local data

- SecureStore: small authentication secrets only.
- SQLite: versioned cached workspace snapshot, catalogue pages, pending
  mutations and sync metadata.
- Memory: transient form state and unsubmitted search filters.

Do not place complete plans, guest contact details or dietary notes in plain
AsyncStorage. Database files must rely on platform data protection, avoid
backups where policy requires it and be cleared on sign-out/account removal.

### Mutation model

- Give offline-created tasks and plan items stable UUIDs.
- Queue semantic mutations with operation ID, workspace ID, base version,
  creation time and redacted diagnostic state.
- Apply optimistic local updates through the shared domain functions.
- Replay in original order when authenticated and online.
- Treat `409 version_conflict` as a first-class UI state. Reload the latest
  snapshot, replay only safe semantic mutations and ask the couple to choose
  when both sides changed the same field.
- Never silently replace a partner's newer budget or table plan.
- Make replay idempotent so app restarts cannot duplicate tasks or selections.

For the first connected alpha, budget updates may continue using the existing
complete-plan PATCH. Fine-grained budget item endpoints are justified only by
measured conflict frequency, not assumed in advance.

### Current concurrency capability and required recovery

| Resource | Current protection | Native blocker/recovery rule |
| --- | --- | --- |
| Budget | Full-plan PATCH compares `expectedBudgetUpdatedAt` in the route and update query | Add full-plan GET. After an ambiguous timeout, GET and compare the intended canonical plan; accept if equal, otherwise rebase semantic operations or show conflict |
| Setup/profile | Profile GET/PATCH has exact versioning, but current web basics save is a non-atomic budget/profile pair | Add transactional setup boundary. A retried request reads both resources and succeeds only when all intended setup fields already match |
| Tasks | Stable client IDs, exact-version PATCH/DELETE, paginated list | Add item GET. Repeated create with the same ID and identical canonical content returns the existing task successfully; same ID/different content remains `409` |
| Table plan | GET/PATCH with `expectedWorkspaceUpdatedAt`; transactional sync RPC | Workspace time changes for tasks/profile as well as table data. On `409`, GET the table plan; if canonical table content still equals the operation's base, retry with the new workspace version, otherwise show a real conflict |
| Workspace import | Transactional RPC supports target ID and expected version | Add HTTP import boundary and make stable-ID retry return the already-imported equivalent snapshot |
| Favourites | Existing owner-scoped venue/supplier tables | New PUT/DELETE API is naturally idempotent and validates the target remains public |

Canonical equality excludes transport timestamps and ordering that has no
product meaning, plus server-owned identity fields such as budget `userId`, but
includes every user-authored value and meaningful `sortOrder`. Conflict recovery
must be covered with two independent authenticated clients, not only sequential
mock calls.

The offline queue stores intent, not replacement JSON. Initial semantic budget
operations are limited to the existing pure-domain actions:

- add/update/remove a manual or catalogue planning item;
- change booking/cost status or the selected venue;
- update an item's estimate/quote;
- replace one item's validated instalment schedule;
- record one item's availability for the current wedding date; and
- update wedding basics only through the transactional setup operation, never
  as an ordinary full-budget replay.

On a budget `409`, load the current plan, check the operation's preconditions,
reapply that one pure operation, validate the result and PATCH using the new
version. If the same item/field changed remotely, stop at `Needs attention`.
Never reapply a captured whole-plan snapshot over the partner's current plan.
An operation moves through `pending`, `in_flight`, `applied` or `conflict` and
is removed only after an acknowledged or equivalently recovered result.

## State ownership

- Server state: authenticated workspace, profile, plan, tasks and table plan.
- Cached server state: last validated DTO plus ETag/version timestamps.
- Device-only state: onboarding draft, unsubmitted forms, view preferences and
  an explicitly labelled local plan before account sync.
- URL/navigation state: catalogue filters and selected detail ID, never the
  authoritative budget or authentication state.

The UI must always show one of four sync labels: `Saved on this device`,
`Saving`, `Saved to My EverAft`, or `Needs attention`. It must not imply partner
sharing when the cloud gate is off.

## Native navigation and presentation

Use four primary tabs: Today, Discover, Plan and You. Guests and table planning
live within Plan for the MVP rather than adding a fifth permanent tab. Modal
detail routes remain deep-linkable and restore focus/position on return.

Native components own layout, gestures, Dynamic Type, VoiceOver/TalkBack
labels, reduced-motion behavior and platform controls. They do not own budget
or recommendation rules. Large catalogues use virtualized lists; galleries load
only after detail navigation.

## Performance budgets

- First useful cached screen: under 1 second on a representative mid-range
  device after initial launch.
- Cold authenticated dashboard: useful skeleton immediately and validated
  content within 2.5 seconds on a typical mobile connection.
- Primary tap response: under 100 milliseconds locally; no blocking network
  request before optimistic state feedback.
- Catalogue page: eight initial cards, bounded prefetch and no full-catalogue
  client payload.
- Image list: explicit aspect ratios and dimensions; detail galleries on
  demand; no layout-changing image placeholders.
- Avoid rerendering catalogue lists when tasks, guests or payments change.

These are native lab budgets. Web Lighthouse remains the release gate for web
surfaces; native profiling uses physical-device launch, render and interaction
traces.

Shared-package or API work must not weaken the original web performance gates:
mobile Lighthouse performance at least 90, LCP below 2.5 seconds, INP below 200
milliseconds and CLS below 0.1 on the agreed representative Planning Hub
journey. N1 establishes a comparable baseline before extraction; every later
web-rendering change is checked against it, and N12 repeats the production-mode
journey. Native timings are not substitutes for these web Core Web Vitals, and
web Lighthouse scores are not evidence of native responsiveness.

## Security and privacy invariants

- RLS remains the final authorization layer for every user-owned record.
- Authorization uses the verified Auth identity, never user-editable metadata.
- Owner and partner see only their shared workspace; outsiders receive the same
  generic unavailable response as nonexistent workspaces.
- Tokens, guest contacts, dietary notes, invitation values and supplier review
  evidence never appear in analytics or routine logs.
- Certificate errors fail closed; no debug trust override ships.
- Clipboard access is not required for normal planning.
- Deep links validate scheme, host, route and token shape before navigation.
- The mobile bundle contains only public configuration.
- Dependency versions and native build tooling are pinned and audited.

## Observability

Use structured, redacted client diagnostics with operation IDs shared with API
requests. Track product outcomes such as profile completion, venue shortlisted,
venue selected, payment recorded and task completed, but exclude names, email,
free text, tokens, precise guest data and supplier evidence.

No paid crash or analytics service is required to begin local development.
Adding one, enabling production collection or changing privacy disclosures is a
separate decision and approval.

## Release topology

| Stage | Data mode | Backend requirement | Distribution |
| --- | --- | --- | --- |
| Local prototype | Seeded + device-only plan | None | Local simulator/device |
| Internal alpha | Device cache + approved test backend | Auth/Data API harness green | Internal builds only |
| Connected beta | Production account sync | Required workspace schema safely separated from the older ten-migration dormant tranche, applied and verified; cloud gate explicitly enabled | TestFlight/closed Android track |
| Public release | Production sync + store compliance | Physical-device, privacy, deletion/export and monitoring gates green | App Store and Play Store |

PR #69's supplier-claim migration is not a dependency for the couple-planning
app shell. It becomes relevant when supplier-owner functionality is included;
it retains its own database-before-application release order.

## Decisions deliberately deferred

- Paid subscriptions or supplier billing.
- A supplier/admin native application.
- Chat, social feed or generic inspiration content.
- Push notifications before tasks/payments and privacy behavior are stable.
- Fine-grained budget-item APIs before whole-plan conflict evidence exists.
- A broad visual redesign of the live web application.
- Apple/Google developer account expenditure or store submission.
