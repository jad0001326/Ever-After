# Planning Hub photography phase

## Outcome

Photography now continues the venue-first Planning Hub instead of sending the couple back to a separate directory or calculator.

The beta route is:

- `/planning-hub/photography`

It remains unlinked from the public navigation, is marked `noindex`, and preserves the existing public photographer directory and Budget Planner.

## Reused architecture

No production schema change is required for this phase.

The existing supplier-neutral `BudgetPlan` and `BudgetItem` model already supports:

- the `photography` budget category;
- website and manual suppliers;
- researching, shortlisted, quoted and booked states;
- estimates and confirmed costs;
- deposits, total paid and the next payment date;
- local-device persistence;
- owner-scoped `budget_plans` cloud persistence.

Published photographer content remains sourced from `supplier_listings` with `category_slug = 'photographer'`. Profile styles and coverage details come from `photographer_profiles`, approved galleries from `supplier_images`, and verified venue relationships from `supplier_venue_connections`.

## User journey

1. Choose or shortlist a venue in `/planning-hub`.
2. Continue to Photography with venue, location and remaining-budget context.
3. Refine by photographer name, location, style and budget.
4. Compare up to three lightweight results.
5. Open full details and an approved gallery on demand.
6. Add a working estimate, confirmed quote or booking to the connected plan.
7. Record deposits, instalments and the next due date.
8. Add an unlisted photographer manually when required.
9. Continue to the existing guest and table-planning experience.

Quote-only profiles remain visible under a budget filter. Couples can enter a working estimate rather than receiving an empty result set simply because published package pricing is unavailable.

## Performance contract

- Search and filtering remain server-side.
- Eight card-sized results are sent to the browser per page.
- Full descriptions, services, coverage details and galleries load only when opened.
- Approved images use `next/image` with explicit responsive sizes.
- The static route shell streams before personalized plan and catalogue queries complete.
- Filter and connected-plan sidebars scroll independently when taller than a desktop viewport.
- Local budget changes remain immediate; cloud persistence follows as a transition.

The final three-run mobile Lighthouse result on the optimized production build was:

| Metric | Run 1 | Run 2 | Run 3 | Median | Target |
| --- | ---: | ---: | ---: | ---: | ---: |
| Performance | 98 | 96 | 97 | 97 | at least 90 |
| LCP | 2.177 s | 2.315 s | 2.242 s | 2.242 s | below 2.5 s |
| TBT (lab interaction proxy) | 129 ms | 165 ms | 140 ms | 140 ms | below 200 ms |
| CLS | 0 | 0 | 0 | 0 | below 0.1 |
| Accessibility | 100 | 100 | 100 | 100 | 100 |
| Best practices | 100 | 100 | 100 | 100 | 100 |

Production INP still requires consented field data after an approved deployment.

## Verification

- 33 test files and 167 tests passing;
- focused photography plan and workspace tests passing;
- TypeScript check passing;
- ESLint passing with one pre-existing unrelated Open Graph image warning;
- optimized Next.js production build passing with 76 generated static pages;
- 31 real published photographers returned in four server-paged result pages;
- compare, on-demand detail, focus entry/return, quote capture and connected budget update verified;
- 390 × 844 layout verified with no horizontal overflow;
- browser console free of relevant warnings and errors.

## Security and release gates

- No new table, migration, grant or RLS policy is introduced.
- Server actions validate supplier identifiers and only return published photographer data.
- Cloud writes continue through the existing authenticated, owner-scoped `budget_plans` action.
- Browser QA that exercises saving must use a signed-out browser, local Supabase stack or disposable development branch. A live authenticated session must be treated as production-write capable.
- No deployment or migration is performed by this phase.

Before release:

1. run the existing `budget_plans` RLS test against a local database or disposable Supabase branch;
2. repeat signed-in save/restore using a disposable test account;
3. complete physical Safari/iPhone verification;
4. review the exact deployment and rollback plan and obtain approval;
5. collect consented field INP after release.

## Selection lifecycle continuation

Photography now shares the confirmed removal component and reusable plan
mutation with venue and generic supplier planning. A removed photographer is
excluded from active cost, payment, availability, shortlist and result-card
state while the retained catalogue option can be added again later. Persistence
continues through the existing device plan or authenticated whole-plan save; no
new table, grant, action or migration is required.

## Rollback

Application rollback is isolated:

1. remove or disable `/planning-hub/photography`;
2. restore the Photography handoff to the existing public `/photographers` directory;
3. leave all `budget_plans` records and migration history intact;
4. preserve the venue-first Planning Hub and public planning tools.
