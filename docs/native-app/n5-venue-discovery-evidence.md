# N5 venue discovery evidence

Date: 25 August 2026

Status: local implementation, Android journey and N5 gates verified. Nothing
in this document authorises
a push, preview, merge, production deployment, Supabase migration, feature-flag
change, supplier-data change, outreach action or paid service.

## Implemented boundary

- `GET /api/catalogue/v1/venues` accepts only bounded public catalogue filters
  and returns exactly eight lightweight records per numbered page.
- Venue pages use featured, name and ID ordering so equal names cannot make
  offset pages unstable.
- `GET /api/catalogue/v1/venues/{id}` loads galleries only on demand, rejects
  malformed IDs, excludes reserved internal-test slugs and returns withdrawn
  records as unavailable.
- Image state is explicit: `approved`, `representative` or `absent`. Missing
  photography stays `null` through the catalogue, planning-domain and budget
  adapters. It is never replaced with the generic reception illustration;
  affected web controls render a labelled neutral placeholder instead.
- Authenticated favourite list and PUT/DELETE routes use the caller-token
  Supabase client, caller ID and existing RLS tables. They never use a service
  client, accept an arbitrary user ID or mix bookmark state into public search.
- The native API client keeps search anonymous and adds the current bearer
  token only to bookmark requests.
- Discover now supports plan-shaped search, explicit eight-result pagination,
  detail, save, a device-persisted three-venue comparison, shortlist, chosen
  venue, estimated/quoted/booked cost state and manual fallback.
- The Plan tab distinguishes bookmarks, comparison and budget decisions, and
  displays venue shortlist/chosen state with the resulting remaining budget.
- N4 payloads migrate to the N5 device format with empty discovery state;
  comparison and bookmark state survive repository reopen.

## Current verification

- TypeScript, production build and lint pass. Lint reports only the existing
  `opengraph-image.tsx` `<img>` warning and no errors.
- Web unit tests pass: 124 files and 553 tests.
- Shared-package tests pass: five files and 13 tests across planning-domain,
  planning-contracts and api-client.
- Mobile tests pass: 25 suites and 102 tests.
- Catalogue API route tests cover bounded filters, private-context rejection,
  cache boundaries, caller identity, target withdrawal and malformed IDs.
- Query tests cover eight-result offsets, deterministic ID tie-breaks, direct
  internal-test denial and all three image states.
- API-client tests cover anonymous public search, bounded client parameters,
  bearer-only bookmark requests, response validation and post-sign-out denial.
- Device-domain tests cover three-item comparison limits/restoration, unique
  bookmarks, duplicate-free shortlist updates, selection, planning costs and
  manual fallback.
- Native component tests cover linear screen-reader controls, image disclosure,
  estimate/quote/booked radios, manual entry and shortlist-versus-chosen Plan
  presentation.
- Web budget-picker coverage proves an absent approved image renders a named
  neutral placeholder rather than an unrelated sample photograph.
- A deterministic deferred-response component test keeps the loading state
  visible while the result list remains empty and bounded, then proves the
  eight-item result surface renders when the request resolves.

## Android emulator journey

Verified on the local `everaft_n3_android` emulator at 1080 x 1920 against the
local production build and the linked catalogue in read-only mode:

- a £25,000 device plan loaded eight price-compatible venues on page one;
- `Show 8 more venues` loaded the next eight records and surfaced Branxholme
  Castle, matching the independently queried second page with no duplicate IDs;
- the Ardgowan House detail loaded on demand and disclosed that its imagery was
  an EverAft illustrated profile awaiting approved venue photography;
- comparison, shortlist and chosen-venue actions remained separate;
- choosing Ardgowan House as a quoted £2,000 venue produced £23,000 remaining;
- after force-stopping and reopening the app, the comparison, chosen venue,
  quoted amount and remaining budget were restored from device storage;
- the restored Today screen recommended photography as the next planning step;
- a manual `Local Test Venue` with a £1,500 estimate was added to the local
  shortlist without a network write; and
- opening a valid but unavailable catalogue UUID rendered `This venue is no
  longer available in the live catalogue.` without exposing record details.
- the first pagination pass exposed a React Native `VirtualizedList` slow-update
  warning; venue rows were extracted into a memoized component with stable
  handlers, and the same eight-more interaction was rerun without the warning.

Cloud bookmark writes were deliberately not exercised because the connected
environment points at production and N5 does not authorise production-data
changes. Bearer-only bookmark behaviour and post-sign-out denial remain covered
by the client and route tests.

## Repository-wide inherited gate

The aggregate `npm test` command passes the web, package, mobile, Planning
Workspace RLS, supplier-owner RLS, supplier-claim review, Data API grant and
supplier-outreach checks. Its final production-migration-alignment step fails
on `20260713151556_phase11_pricing_recovery.sql` because the recorded hash is
for CRLF bytes and the repository file uses LF bytes. Converting the current
file to CRLF reproduces the recorded hash exactly, and the unchanged file also
matches `origin/main`. N5 does not modify migrations or suppress this inherited
gate.

The final diff contains only N5 catalogue contracts/routes/client code, native
venue screens and persistence, focused tests, the public mobile environment
example and this evidence. Generated `next-env.d.ts` output was restored and
no local environment file is tracked.

No database migration is required for N5. A push, Vercel preview and any
production API deployment remain external approval points.

## Pull-request dependency

GitHub was refreshed read-only on 25 August 2026. N3 pull request #71 is
merged. N4 pull request #72 is a clean draft with successful repository and
Vercel checks, and N5 is based directly on its reviewed commit `f29101b`.

To preserve one reviewable phase per pull request, either merge #72 before
opening N5 against `main`, or open N5 as a temporary stacked draft against
`codex/native-app-n4-connected-workspace` and retarget it after #72 merges.
Opening N5 against `main` while #72 remains unmerged would incorrectly include
both N4 and N5 in the same diff.
