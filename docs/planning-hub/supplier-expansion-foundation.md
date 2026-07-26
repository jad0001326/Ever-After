# Planning Hub supplier expansion foundation

Date: 26 July 2026

## Decision

Planning Hub supplier discovery now has a category-neutral server data layer.
Photography remains the only enabled supplier stage because it is the only
category currently marked live in `supplierDirectoryCategories`.

No route, navigation item or recommendation is exposed for an inactive
category. The shared layer prepares future categories without presenting an
empty catalogue to couples.

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

Photography is now a specialization over those contracts. It adds:

- photography-style candidate matching;
- photographer profile fields;
- coverage and turnaround detail;
- the existing photography-specific cards, filters and planning interface.

## Connected budget business logic

Known supplier categories now share the same reusable plan conversion:

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

## Activation rules

A second supplier stage must not be enabled merely because its category mapping
exists. Activation requires:

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
categories. They remain unavailable to users.

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

- 46 test files and 228 tests passing;
- focused category-normalization and Photography-specialization tests passing;
- TypeScript check passing;
- ESLint passing with one pre-existing unrelated Open Graph image warning;
- optimized Next.js production build passing with 77 generated pages;
- production-mode `/planning-hub/photography` browser regression at 390 x 844;
- unavailable-search and manual-entry states render without browser errors.

## Rollback

The refactor is internal and preserves the existing Photography interface.
Rollback consists of restoring the former Photography-specific query module and
removing the shared supplier contracts. No saved plan, route, database record or
migration needs to be changed.
