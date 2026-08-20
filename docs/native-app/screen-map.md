# Native app screen map

Date: 20 August 2026

This route and responsibility map is paired with the compact/expanded layouts
in [Responsive wireframes](responsive-wireframes.md).

Status: proposed local navigation and state map.

## Navigation model

The signed-in app uses four bottom tabs. A fifth tab would crowd small iPhone
screens, so guests and tables sit inside Plan.

| Tab | Route | Purpose |
| --- | --- | --- |
| Today | `/today` | Next action, deadlines, progress and budget snapshot |
| Discover | `/discover` | Venue and supplier decisions |
| Plan | `/plan` | Budget, payments, tasks, guests and tables |
| You | `/you` | Profile, partner, storage, privacy and account |

Detail and editing screens are pushed above the tabs. Authentication and
onboarding use separate stacks so a protected deep link can resume after sign
in without flashing private content.

## Route tree

```text
/
├── auth
│   ├── welcome
│   ├── sign-in
│   ├── sign-up
│   ├── forgot-password
│   └── reset-password
├── onboarding
│   ├── basics
│   ├── budget-and-priorities
│   ├── storage-choice
│   └── complete
├── today
├── discover
│   ├── venues
│   │   ├── search
│   │   ├── [venueId]
│   │   ├── compare
│   │   └── manual
│   ├── photography
│   │   ├── search
│   │   ├── [supplierId]
│   │   └── manual
│   └── suppliers/[category]
│       ├── search
│       ├── [supplierId]
│       └── manual
├── plan
│   ├── budget
│   │   ├── [itemId]
│   │   ├── [itemId]/payments
│   │   └── add-manual
│   ├── tasks
│   │   └── [taskId]
│   ├── guests
│   │   └── [guestId]
│   └── tables
│       └── edit
└── you
    ├── wedding-profile
    ├── partner
    ├── plans
    ├── sync-and-offline
    ├── notifications
    ├── privacy-and-data
    └── delete-account
```

Only routes backed by released functionality appear in navigation. For
example, additional supplier categories and full native table editing remain
hidden until their evidence gates pass; they are not disabled promotional
tiles.

## Primary flow

```text
Welcome → sign in or device-only start → onboarding → Today
                                                    ↓
                         venue recommendation → venue search
                                                    ↓
                         save → compare → select/manual entry
                                                    ↓
                  budget + payments update → photography next
                                                    ↓
                      tasks, guests and tables → weekly return
```

Back navigation must return to the user's previous filters and scroll
position. Selecting an item must not unexpectedly switch tabs or discard an
unfinished comparison.

## Screen responsibilities

| Screen | Minimum data | Primary actions | Mandatory special states |
| --- | --- | --- | --- |
| Welcome | Product promise, storage availability | Sign in, sign up, device-only start | Connected planning unavailable |
| Sign in/up | Auth fields, intended destination | Authenticate, reset password | Restoring session, validation, expired link, offline |
| Onboarding basics | Date/season, location, guests | Continue, skip unknown fields | Draft recovery, offline |
| Budget and priorities | Budget, ranked priorities | Save and finish | Invalid/unknown budget |
| Storage choice | Device/cloud explanation | Choose, continue | Cloud disabled, existing local plan |
| Today | Recommendation, budget summary, deadlines, progress | Open next action, task or payment | Empty plan, offline cache, sync conflict |
| Discover | Released categories and recent items | Open category, resume comparison | No released category beyond venues |
| Venue search | Filter summary, bounded page/total, bookmark/compare state | Filter, save, compare, shortlist, load more, manual entry | No results, end of results, offline cache |
| Venue detail | Approved images, facts, costs, saved state | Save, shortlist, compare, select | Withdrawn listing, image unavailable |
| Venue compare | Two or three selected venues, same attributes | Remove, reorder, open, select | Missing attribute, withdrawn item |
| Supplier search/detail | Bounded catalogue plus venue, location, date, remaining-budget and bookmark context | Save, compare, shortlist, select, record availability, manual | Thin coverage, unchecked date, unavailable listing |
| Plan home | Budget, payments, tasks, guests/table summary | Open planning area, add item/task | Device-only, sync state |
| Budget | Category/item totals and statuses | Add, filter, open item | Empty plan, conflict |
| Budget item | Cost/status/source/availability | Edit, select listing, add payments | Listing unavailable, validation |
| Payments | Paid and scheduled amounts | Add, edit, mark paid, remove | Over-allocation, overdue, offline queue |
| Tasks | Ordered tasks and due dates | Add, complete, edit, delete | Empty, overdue, replay conflict |
| Guests | Counts and guests | Add/edit/remove, open tables | P0 web handoff, sensitive data offline |
| Tables | Tables and assignments | Arrange, unassign, save | P0 web handoff, concurrent edit |
| Wedding profile | Core wedding preferences | Edit and save | Unknown values, conflict |
| Partner | Own/partner membership and one active invitation | Create/share or revoke invite, accept, remove partner | Feature unavailable, partner already connected, expired/wrong-email invite, offline removal limitation |
| Plans | Accessible workspaces | Switch or create plan | No cloud access, unsynced local plan |
| Sync and offline | Last sync, pending operations, storage mode | Retry, inspect conflicts | Offline, auth expired, migration gate off |
| Privacy and data | Data use, session and export status | Sign out locally/everywhere, request/download export, open policy | Unsynced-work warning, export preparing/expired/failed |
| Delete account | Versioned impact summary: owned/shared plans, partner, supplier role, Storage and retention outcomes | Reauthenticate, transfer/remove partner where required, confirm delete or cancel | Stale impact, pending offline edits, retryable deletion, completed receipt |

## Catalogue interaction rules

- Initial cards contain only information needed to choose whether to open the
  listing: name, location, category/type, permission-qualified thumbnail or
  profile treatment, explicit visual status, key price cue and saved state.
- Search and filters execute on the server. The client keeps only loaded pages
  and filter state.
- Load eight cards initially, then fetch the next numbered page on explicit or
  safe incremental loading.
- Detail galleries fetch on demand and use appropriately sized images.
- Comparison uses a stable set of meaningful attributes; absent data is shown
  as `Not provided`, never as a negative claim.
- The manual-entry route stays visible from empty results and the end of every
  relevant catalogue flow.
- Venue, Scottish location and remaining budget may narrow supplier results;
  the wedding date is displayed as planning context but never treated as proof
  of availability.
- Approved photography, labelled representative imagery and an image-pending
  profile treatment are three distinct visual/accessibility states.
- Bookmark, compare, shortlist and selection controls use different labels and
  accessible pressed states. A bookmark never changes the budget; a shortlist
  action explains the planning item it will create.

## Deep links

| Link intent | Destination | Signed-out behavior |
| --- | --- | --- |
| Open venue | `/discover/venues/{id}` | Save intent, sign in, then resume |
| Open supplier | `/discover/suppliers/{category}/{id}` | Save intent, sign in, then resume |
| Open task | `/plan/tasks/{id}` | Sign in, verify workspace access, then open |
| Open payment | `/plan/budget/{itemId}/payments` | Sign in, verify workspace access, then open |
| Accept partner invite | `/you/partner?invite=…` | Keep token protected, authenticate, confirm before acceptance |
| Reset password | `/auth/reset-password` | Validate one-time link without opening app content |

Invitation and reset tokens must be redacted from analytics, logs and support
screens. A deep link for an unavailable or inaccessible private record uses a
generic message and returns to a safe tab.

An invite token interrupted by authentication is held only in secure ephemeral
storage for up to one hour. The app deletes it after acceptance, cancellation,
expiry or account mismatch and never copies it without an explicit share/copy
action by the owner.

## Offline and sync presentation

The global status is compact but always reachable from Today and You:

- `Saved on this device` — local authoritative plan, no cloud claim.
- `Saving` — a local write or sync is in progress.
- `Saved to My EverAft` — the latest local version is acknowledged remotely.
- `Needs attention` — auth, validation or version conflict needs a decision.

Screens render cached data with its last-updated time. A network-only action is
disabled with an explanation; ordinary plan edits stay available and queue.
Retry never creates duplicate tasks, payments or selections.

## Empty, error and conflict behavior

- Empty screens lead to one useful action and never imply missing data is a
  fault.
- Search failure preserves filters and any existing results.
- Session expiry preserves local unsynced work, then restores the intended
  route after authentication.
- Account switching never renders the previous account's cached plan while the
  next session is resolving.
- Account deletion never begins from a stale impact screen. If the plan,
  partner, Storage or retention outcome changes, confirmation is invalidated and
  the current impact is shown again.
- A lost deletion response resumes the same idempotent operation and shows its
  real server state; the app never guesses success from a network error.
- Catalogue withdrawal does not erase the couple's historical budget item;
  it changes availability and offers manual maintenance.
- A partner conflict shows the affected section, local and remote update times,
  and safe choices. It never silently chooses a winner for budget or seating.
- Connected-planning `503` is translated to a calm availability message and a
  supported device-only path, not a database error.

## Accessibility and small-screen rules

- Each screen has one logical heading and a stable screen-reader title.
- Every icon-only control has a spoken label, state and hint where useful.
- Touch targets are at least 44 by 44 points with adequate spacing.
- Text supports dynamic type without clipping totals or hiding primary actions.
- Status never relies on colour alone; contrast meets WCAG AA.
- Search filters open as a readable full-height sheet on small phones.
- Tables and comparisons provide a linear accessible alternative to horizontal
  layouts.
- Motion respects reduced-motion preferences and is never required to perceive
  a saved, selected or conflict state.
- Keyboard focus, error summary and form labels are verified for any web view
  handoff used during the transition.
