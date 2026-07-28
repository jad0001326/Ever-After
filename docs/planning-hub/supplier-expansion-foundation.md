# Planning Hub supplier expansion foundation

Date: 26 July 2026

## Decision

Planning Hub supplier discovery has a category-neutral server data layer.
Photography remains the only live supplier catalogue because it is the only
category currently marked live in `supplierDirectoryCategories`.

Inactive categories are exposed as truthful manual-planning stages from the
supplier roadmap. They do not query or display supplier listings. The shared
layer prepares future catalogues without presenting an empty catalogue to
couples.

## Shared contracts

The shared supplier layer provides:

- lightweight supplier card records;
- on-demand detail records and approved galleries;
- category, search, venue, location, budget, sort and page inputs;
- bounded and normalized URL filters;
- eight-result server pagination;
- venue-region, venue-town, service-area, nationwide and verified-connection
  matching;
- category-aware published-listing queries;
- price, featured, newest and name ordering;
- a stable manual-entry fallback at the Planning Hub workspace layer.

Photography is a specialization over those contracts. It adds:

- photography-style candidate matching;
- photographer profile fields;
- coverage and turnaround detail;
- the existing photography-specific cards, filters and planning interface.

## Connected budget business logic

Known supplier categories share the same reusable plan conversion:

- map the directory category to its existing Budget Planner category;
- retain source listing identity, imported prices and future listing URL;
- record researching, shortlisted, quoted and booked states consistently;
- preserve deposits, instalments and payment deadlines when a listing is
  updated;
- support manual entry through the same category mapping;
- distinguish supplier types that intentionally share a budget category, such
  as DJs and bands.

Photography keeps its existing wrapper functions, so this refactor does not
change the current route or browser interface. Future web and native clients can
call the category-neutral business rules directly.

## Date-aware availability

The supplier directory does not store supplier calendars. Planning Hub
therefore does not filter or label a business as available merely because the
couple has entered a wedding date.

Instead, every connected venue and supplier budget item carries a reusable
availability state:

- not checked;
- enquiry sent;
- available;
- unavailable.

Any non-default state is tied to the exact wedding date it was checked against.
If the couple changes their date, the earlier answer becomes stale and the
interface asks them to confirm it again. A booked item is marked available
automatically only when the plan already has a specific wedding date. Organise
prioritises a chosen venue or photographer that still needs a date check,
follow-up or replacement before recommending the next supplier stage.

This state is part of the existing versioned budget JSON contract, with
validation and legacy restoration defaults. It adds no catalogue query, public
calendar claim, table, migration, grant or production write.

## Activation rules

A second supplier catalogue must not be enabled merely because its category
mapping or manual-planning stage exists. Catalogue activation requires:

1. a meaningful set of published listings in `supplier_listings`;
2. representative or approved visual handling for the category;
3. useful category-specific filters or a deliberate decision that the shared
   filters are sufficient;
4. budget-category mapping;
5. manual-entry support;
6. server pagination and detail loading;
7. mobile, keyboard and screen-reader verification;
8. an explicit recommendation rule defining when the category is the logical
   next planning step.

The current inactive mappings include videography, celebrants, floristry,
catering, music, transport, cake, beauty, stationery, decor and other supplier
categories. They remain available for manual planning only.

## Security and data boundaries

- Search and detail queries always require a known category slug.
- Only `listing_status = 'published'` supplier records are returned.
- Detail loading rechecks both the supplier identifier and category.
- Galleries return only `permission_status = 'approved'` images.
- Venue context reads only published venue records.
- The browser receives at most one result page and never the full catalogue.
- No new mutation, table, migration, grant or RLS policy is introduced.
- No production data, deployment or paid Supabase branch is used.

## Verification

- 65 test files and 296 tests passing after the date-availability slice;
- focused category-normalization and supplier-continuity tests passing;
- focused date-availability component, persistence, plan-domain,
  recommendation and workspace-persistence tests passing;
- TypeScript check passing;
- ESLint passing with one pre-existing unrelated Open Graph image warning;
- optimized Next.js production build passing with 78 generated pages;
- production-mode supplier roadmap and manual stage checked at 390 x 844;
- manual-only supplier stages make no catalogue request and render without
  browser errors.

## Rollback

The shared supplier data layer still preserves the Photography interface.
Rollback of the roadmap slice consists of removing the roadmap route,
manual-only route access and supplier recommendation. No saved plan, database
record or migration needs to be changed.
