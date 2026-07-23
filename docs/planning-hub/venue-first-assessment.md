# My EverAft — venue-first delivery record

Date: 23 July 2026

Core positioning: **EverAft turns wedding browsing into an actual wedding plan.**

## Decision

The Planning Hub is an orchestration layer over the existing catalogue and planners, not a replacement for them. The first vertical slice connects venue discovery to the current Budget Planner model, then hands the couple to photography with their venue context intact.

The beta remains at `/planning-hub`, is marked `noindex`, and is not linked from the public navigation. The public Budget Planner remains unchanged and available.

## What this slice delivers

- server-rendered venue search with explicit result columns, filtering and page pagination;
- a maximum of eight lightweight venue results per request;
- separate on-demand venue detail and approved-gallery loading;
- saved favourites, plan shortlist, comparison and selected venue as distinct states;
- researching, shortlisted, quoted and booked planning stages;
- editable planning cost, deposit, paid total and next due date;
- derived planned, committed, paid and remaining budget totals from the shared Budget Planner calculations;
- local-device persistence for signed-out exploration and owner-scoped cloud saving for signed-in users;
- manual venue entry when the catalogue does not contain the venue;
- a venue/location/remaining-budget handoff to the photography directory;
- responsive loading, empty and error states.

## Data and security

The slice reuses:

- `profiles` and Supabase Auth for identity;
- `favourites` for saved venues;
- `budget_plans` for the active wedding plan;
- `venues`, `venue_price_options` and approved `venue_images` for discovery;
- the existing photography directory for the next stage.

The included `budget_plans` migration history records the deployed owner-scoped design:

- composite ownership key `(user_id, id)`;
- owner-only select, insert, update and delete policies;
- explicit authenticated grants;
- no anonymous table grants;
- an index on `(user_id, updated_at desc)`.

No migration is applied by this branch. Any future partner-sharing, normalized payment or guest/table schema needs a separate reviewed migration, cross-user RLS tests, rollback SQL and explicit production approval.

## State semantics

- **Saved:** a venue favourite.
- **Shortlisted:** a venue item in the active plan.
- **Compared:** a transient selection of up to three venue results.
- **Quoted:** a plan item with a confirmed supplier quote.
- **Booked:** a committed plan item.
- **Partially paid / paid:** derived from paid amount versus the planning cost.
- **Selected venue:** the plan's primary venue; other shortlist items remain intact.

## Performance contract

- Never transfer the catalogue to a client component.
- Select only result fields required by the card.
- Keep venue price eligibility on the server.
- Page result cards in small batches.
- Load gallery records only after the couple opens a venue.
- Preserve image aspect ratios and supply accurate `next/image` sizes.
- Stream the static Planning Hub shell before catalogue/account queries complete.
- Preserve the public venue result layout while its filters resolve.
- Keep shared budget calculations pure and covered by regression tests.

## Local verification

Completed on the clean integration branch:

- full current test suite: 31 files and 159 tests passing;
- focused Planning Hub and cookie-consent tests passing;
- TypeScript check passing;
- focused ESLint checks passing;
- optimized Next.js production build passing, including 75 generated static pages;
- read-only browser checks for paged results, on-demand detail and two-venue comparison;
- mobile Lighthouse accessibility 100, best practices 100 and CLS 0.

The mobile performance score has met 90 in repeat lab runs. LCP remains variable and above the 2.5-second target in the local throttled environment, so release approval remains gated on a stable production-like median and field Core Web Vitals. No deployment has occurred.

## Remaining release gates

1. Establish a stable three-run mobile Lighthouse median for Planning Hub and the public venue route.
2. Complete keyboard-only and mobile-device interaction checks for filter, compare, detail, manual entry and payment editing.
3. Add authenticated RLS integration coverage for owner and unrelated-user plan access.
4. Review the dependency audit findings without force-upgrading packages.
5. Present the exact deployment and rollback plan for explicit approval.

## Rollback

The route is isolated and unlinked. Application rollback is therefore:

1. remove or disable `/planning-hub`;
2. retain the public Budget Planner and catalogue routes;
3. do not remove `budget_plans` data or migration history;
4. revert the public venue filter-shell change only if it causes a measured regression.

