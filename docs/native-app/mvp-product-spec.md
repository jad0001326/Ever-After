# Native app MVP product specification

Date: 20 August 2026

Status: proposed local specification. It does not authorise implementation,
external builds, migrations, deployment, store expenditure or release.

## Product promise

My EverAft gives a couple one calm place to turn Scottish venue and supplier
decisions into a wedding plan they can keep using every week.

The MVP is successful when a couple can answer three questions quickly:

1. What have we decided and committed to?
2. What can we still afford?
3. What should we do next?

It is not a directory wrapped in an app. Discovery must flow into comparison,
selection, budget, payments and next actions.

## Primary users

- A lead planner starting or resuming a Scottish wedding plan.
- Their invited partner, once connected sharing is released.
- A returning couple checking a deadline, cost or decision on a phone.

Supplier administration, catalogue enrichment and claim review remain web
operations. They are not part of this couple-facing app.

## MVP outcomes

The first native release must let a couple:

- create or resume a plan without losing access when the connection drops;
- establish their date, location, guest count, budget and priorities;
- discover a bounded, useful set of venues and photographers;
- save, compare and select a listing, or enter one manually;
- record estimates, quotes, bookings, payments and future instalments;
- see remaining budget and the next useful planning action;
- manage immediate tasks; and
- understand whether work is stored on the device, syncing or needs attention.

## P0 scope: internal alpha

### Account and plan start

- Welcome, sign in, sign up and password-reset entry points.
- A deliberate choice between a device-only plan and a connected My EverAft
  plan whenever connected planning is actually available.
- Resume the most recent plan, with an explicit plan chooser if an account has
  more than one accessible workspace.
- Onboarding for wedding date or season, Scottish location, expected guests,
  working budget and ranked priorities.

Device-only mode must remain honest: it cannot promise partner sharing or
cloud recovery while those capabilities are disabled.

### Today

- One recommended next action with a reason and direct destination.
- Budget summary: total, committed, paid and remaining.
- The closest relevant payment deadline and task deadline.
- Short progress summary for venue, photography and essential setup.
- Clear offline and sync state.

### Discover

- Server-filtered, paginated venue search using small result cards.
- Venue details, approved images loaded on demand, key facts and planning cost.
- Save, shortlist, compare and select a venue.
- Photographer search and detail using the live supplier source of truth,
  including save, shortlist and comparison.
- Supplier discovery context derived from the selected venue, Scottish
  location and remaining budget, with the wedding date carried into the plan.
- Manual venue and photography entry when catalogue coverage is insufficient.
- No client-side download of the complete venue or supplier catalogue.
- No inferred availability: a date remains unchecked until the couple records
  a supplier's real response.

`Saved` is a bookmark and does not affect the budget. `Compared` is a local set
of up to three options. `Shortlisted` creates a planning item and may carry an
estimate or quote. Only a selected venue changes `selectedVenueId`; only booked
costs count as commitments. The interface must use these terms consistently.

### Plan

- Budget categories and items with estimated, quoted, booked, partially paid
  and paid states.
- Deposits, individual payments, future instalments and due dates.
- Immediate recalculation of committed, paid and remaining amounts.
- Selection availability and an explanation when a catalogue selection is no
  longer available.
- Task list with create, complete, edit and delete actions.
- Compact guest-count and table-plan summaries that link to the existing web
  tools until their full native editors pass the P1 release gate.

### You

- Wedding profile and priorities.
- Account identity, plan storage mode and sync status.
- Partner-sharing status, shown as unavailable until its backend and UI ship
  together.
- Privacy, export and deletion information. Public release requires functional
  account export and deletion, not informational placeholders.
- `Sign out of this device` and `Sign out everywhere` with clear consequences
  for unsynced work and other signed-in devices.

## P1 scope: connected beta

- Invite, accept, remove and display a planning partner with clear ownership.
- Full guest management and native table editing.
- Additional supplier categories only after each category has useful published
  coverage, truthful imagery, mobile-usable filters and complete profiles.
- Local reminders for tasks and payments; remote push only after consent,
  privacy, token lifecycle and delivery behavior are verified.
- Account export and deletion flows.

## Explicit non-goals

- Supplier or admin operations in the native app.
- Supplier billing, couple subscriptions or invented pricing.
- Chat, a social feed, generic inspiration content or AI planning theatre.
- Publishing thin supplier categories to make the app appear broader.
- Replacing the public web Budget Planner or Table Planner before equivalent
  native functionality is proven.
- Rebuilding shared planning calculations inside screen components.

## Core journeys and acceptance criteria

### 1. Start a useful plan

Given a new user, when they enter the minimum wedding details and budget, then
the app creates a recoverable local plan, shows an accurate remaining budget
and recommends venue discovery. Every field can be corrected later.

When that plan becomes connected, total budget, wedding date, guest count,
location and preferences save as one setup change. A failure leaves both the
previous budget and previous profile intact; the UI never reports a partially
updated wedding setup as saved.

### 2. Turn discovery into a decision

Given venue search criteria, the user receives a first page without downloading
the catalogue, can open details, save and compare candidates, and select one as
estimated, quoted or booked. Selection creates or updates the correct planning
item and recalculates totals immediately. Manual entry remains available.

Given a saved or compared option, reopening the app restores the bookmark and
current device comparison without adding either to committed spend. Promoting
an option to the shortlist creates exactly one planning item.

### 3. Record a real commitment

Given a selected venue or supplier, the user can record total cost, deposit,
payments and instalments. Paid cannot exceed the valid total without a clear
confirmation or correction path. Reopening the app reproduces the same totals.

### 4. Know what comes next

After the venue stage is meaningfully complete, Today recommends photography
and explains why. A recommendation links to the exact action, can be dismissed
where appropriate and never claims an unavailable category is ready.
Photography results use the selected venue, Scottish location and remaining
budget where available, while keeping date availability explicitly unchecked.

### 5. Keep working offline

Given a lost connection, previously opened planning data remains usable and
local edits are visibly saved. On reconnection, queued operations replay once.
A version conflict is surfaced as `Needs attention`; the app never silently
overwrites a partner's newer plan.

Given a response lost after the server committed a write, retry or recovery
reads must recognise the already-applied budget, profile, task, table or
workspace operation. The couple sees one result, not a duplicate or a false
failure. An unrelated task/profile timestamp change must not be presented as a
table-plan disagreement when the table content itself is unchanged.

### 6. Share safely

In connected beta, an owner can invite one partner and the invited account sees
only the accepted shared workspace. Invalid, expired and reused invitations
fail without revealing private plan details. Removing access takes effect on
the next authenticated request and sync attempt.

The workspace permits one owner, one partner and one active invitation. The raw
link is shown once for system sharing and is never sent automatically. A lost
acceptance response can be retried by the same confirmed account without adding
a second membership. The owner can revoke an unused invitation or remove the
partner but cannot remove or demote themselves.

Removal stops future server access but cannot remotely erase a device that is
offline. The removed partner's app locks and clears the shared cache when it
next checks membership; this limitation is explained before removal.

### 7. Control and remove personal data

The account area provides a real personal-data export and in-app account
deletion before public release. Export covers the caller's profile, planning
data and relevant account activity in a portable form; it does not expose
another user's authentication details, internal review evidence or secrets.
The user may download an export without agreeing to delete their account.

Before deletion, EverAft shows a current impact summary: owned and shared plans,
partner consequences, supplier/vendor responsibilities, device-only unsynced
work and any categories of records retained or anonymised under the approved
policy. A shared-plan owner cannot unknowingly delete their partner's plan. The
MVP either transfers ownership atomically or requires partner removal followed
by a separate explicit delete-for-everyone confirmation.

Deletion requires fresh authentication but not a support request. It is safe
to retry after a lost response, removes or transfers owned Storage objects,
terminates refresh capability, clears this device's private cache and provides
a truthful terminal result. A technical failure never presents the account as
deleted. Retention periods and lawful bases are product/legal decisions and
must be approved rather than invented during implementation.

## Required product states

Every data-bearing screen must have designed states for:

- first load and cached load;
- empty but actionable data;
- offline with cached data and offline without cached data;
- unauthenticated or expired session;
- connected planning disabled;
- validation failure;
- unavailable or withdrawn catalogue item;
- rate/network/server failure with retry;
- saving, saved locally, synced and conflict; and
- insufficient catalogue coverage with manual entry.

No error state should expose database names, internal IDs, tokens or another
user's existence.

## Measurement

The MVP should collect minimal, consent-aware and redacted product events. The
first decision metrics are:

- onboarding completion;
- first budget saved;
- first venue search, save, comparison and selection;
- first payment or task recorded;
- users returning in a later week;
- sync completion and conflict rate; and
- crash-free sessions and screen response budgets.

These are product-health measures, not commercial targets. Do not add a paid
analytics service merely to ship the internal alpha.

## Quality and release gates

Before internal alpha:

- shared-domain, schema and API-client tests pass;
- the device-only golden journey passes after an app restart and offline;
- useful cached content appears within one second and primary local feedback
  appears within 100 milliseconds on representative devices;
- first catalogue responses are bounded and galleries load on demand; and
- no service-role key, private token or personal planning data appears in the
  bundle or diagnostic logs.

Before connected beta:

- the real Supabase Auth/Data API harness passes against an approved test
  environment;
- workspace RLS, outsider denial, partner access and conflict cases pass;
- required workspace migrations have an isolated, reviewed deployment path;
- authenticated dashboard content is useful within 2.5 seconds on a typical
  mobile connection; and
- current iPhone and representative Android physical-device journeys pass.

Before public release:

- VoiceOver and TalkBack journeys pass for onboarding, discovery, selection,
  budget and account controls;
- dynamic text, contrast, focus order, reduced motion and 44-point minimum
  touch targets are verified;
- account export/deletion, privacy wording and store disclosures are complete;
- session restoration, local/global sign-out, password-reset deep links and
  logout cache isolation pass on physical iOS and Android devices;
- crash, sync and API health monitoring has an owned response path; and
- App Store and Play Store builds, screenshots and review accounts are
  separately approved.

## Privacy and trust rules

- Collect only information required for planning or requested reminders.
- Keep guest contacts, dietary notes, invitation tokens and payment schedules
  out of analytics and ordinary logs.
- Explain device-only versus connected storage before the user relies on it.
- Use approved listing imagery only and label representative imagery honestly.
- Treat approved, representative and absent supplier imagery as distinct data
  states throughout cards, details and comparisons; never infer approval from
  the presence of an image URL.
- Never imply that saving a supplier sends an enquiry or confirms availability.
- Make destructive account and plan actions explicit and recoverable where
  practical.
- Never use a database cascade as the product definition of account deletion;
  inventory shared, operational, audit and Storage data and test every outcome.
- Never retain another account's decrypted plan, comparison set or queued
  mutations after account switching.
