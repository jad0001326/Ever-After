# Planning Hub supplier-stage gating

Status: implemented locally; photography remains the only live catalogue.

The Planning Hub has a lightweight supplier roadmap at:

`/planning-hub/suppliers`

Every known category is visible from the roadmap, but catalogue access remains
intentionally gated:

- unknown categories render the site 404 experience;
- known categories with `live: false` render a manual-planning stage and do not
  run a supplier search or display catalogue results;
- photography redirects to the established `/planning-hub/photography` stage
  and preserves its query parameters;
- a non-photography catalogue can render only after its directory configuration
  is explicitly changed to `live: true`.

This lets a couple plan every supplier category today without presenting an
unfinished or sparsely populated catalogue as launched. Saved manual entries
return to their exact planning item, including partner-workspace context.

## Reusable experience

When a category catalogue is ready, the shared stage provides:

- server-side name, location, venue, budget and sort filtering;
- eight lightweight supplier cards per page;
- on-demand detail and approved gallery loading;
- comparison of up to three suppliers without changing the budget;
- researching, shortlisted, quoted and booked planning states;
- manual entry when EverAft does not list a suitable supplier;
- connected deposits, instalments and payment deadlines;
- personal or partner-workspace persistence using the existing budget plan.

Category-specific budget mappings come from `supplierDirectoryCategories`.
Supplier types are also checked when categories share one budget category, such
as DJs and bands.

Inactive categories use the same connected budget and payment business logic,
but expose only the manual-entry path. Moving a category from manual planning to
a live catalogue is a separate activation decision.

## Activation checklist

Do not set a category to `live: true` until all of the following are true:

1. A useful number of real, published `supplier_listings` exists for the
   category.
2. Listing summaries, locations, pricing and approved image rights have been
   checked.
3. The public full-profile route for that category is available.
4. Search, empty, error, manual-entry, comparison and payment behavior has been
   verified with that category's real data.
5. Mobile accessibility and performance checks pass.
6. Any production data, migration or deployment action has been explained and
   explicitly approved.

## Local verification

Completed on 28 July 2026:

- focused supplier and continuity tests: 5 files and 27 tests passed;
- full suite: 60 files and 275 tests passed;
- TypeScript: passed;
- lint: passed with one unrelated pre-existing OG-image warning;
- optimized production build: 78 pages generated successfully;
- mobile browser at 390 x 844:
  - the roadmap showed all 16 supplier categories and marked only photography
    as catalogue live;
  - an inactive florist stage performed no `supplier_listings` request;
  - a quoted manual florist persisted across navigation and reopened by its
    exact `planItem` identifier;
  - roadmap and manual-stage widths matched the viewport;
  - axe reported zero violations on both routes and browser errors were empty;
- three mobile Lighthouse runs on the roadmap:
  - performance 98 in every run;
  - accessibility 100 and best practices 100 in every run;
  - LCP 2.243-2.249 seconds;
  - CLS 0;
  - total blocking time 70-80 milliseconds.

No Supabase migration, production write, deployment or paid branch was used.
