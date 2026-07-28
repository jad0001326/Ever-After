# Planning Hub supplier-stage gating

Status: implemented locally; no new supplier category is active.

The Planning Hub now has a reusable supplier-stage route at:

`/planning-hub/suppliers/[category]`

The route is intentionally category-gated:

- unknown categories render the site 404 experience;
- known categories with `live: false` also render the site 404 experience;
- photography redirects to the established `/planning-hub/photography` stage and preserves its query parameters;
- a non-photography category can render only after its directory configuration is explicitly changed to `live: true`.

This keeps unfinished or sparsely populated catalogues out of navigation and avoids presenting an empty supplier stage as launched.

## Reusable experience

When a category is ready, the shared stage provides:

- server-side name, location, venue, budget and sort filtering;
- eight lightweight supplier cards per page;
- on-demand detail and approved gallery loading;
- comparison of up to three suppliers without changing the budget;
- researching, shortlisted, quoted and booked planning states;
- manual entry when EverAft does not list a suitable supplier;
- connected deposits, instalments and payment deadlines;
- personal or partner-workspace persistence using the existing budget plan.

Category-specific budget mappings come from `supplierDirectoryCategories`. Supplier types are also checked when categories share one budget category, such as DJs and bands.

## Activation checklist

Do not set a category to `live: true` until all of the following are true:

1. A useful number of real, published `supplier_listings` exists for the category.
2. Listing summaries, locations, pricing and approved image rights have been checked.
3. The public full-profile route for that category is available.
4. Search, empty, error, manual-entry, comparison and payment behavior has been verified with that category’s real data.
5. Mobile accessibility and performance checks pass.
6. Any production data, migration or deployment action has been explained and explicitly approved.

## Local verification

Completed on 28 July 2026:

- focused supplier tests: 19 passed;
- full suite: 48 files and 234 tests passed;
- TypeScript: passed;
- lint: passed with one unrelated pre-existing OG-image warning;
- optimized production build: 77 pages generated successfully;
- mobile browser at 390 × 844:
  - inactive videographer route showed the unavailable/404 experience;
  - photography alias redirected to `/planning-hub/photography`;
  - search, location, budget and workspace query parameters were preserved;
  - redirected page width matched the viewport and browser errors were empty.

No Supabase migration, production write, deployment or paid branch was used.
