# My EverAft Planning Hub objective audit

Date: 28 July 2026

Status: the local beta now covers the connected planning journey. Production
release and secure cloud sharing remain deliberately gated.

## Delivered locally

| Objective | Current local result |
| --- | --- |
| Wedding profile | Budget, date, guest count, location and priorities drive the workspace and recommendations. |
| Venue discovery | Server-side filters and pagination return lightweight cards; details and approved galleries load on demand. |
| Venue planning | Couples can save, compare, manually add and select venues with estimated, quoted and booked states. |
| Connected budget | Selections update committed and remaining budget; the budget/booking overview exposes estimates, quotes, bookings and payment progress. |
| Photography next step | Selecting a venue leads into live photography discovery, comparison, manual entry and payment planning. |
| Supplier breadth | A 16-category roadmap exposes photography as catalogue live and every inactive category as an explicit manual-planning stage without catalogue queries. |
| Payments | Deposits, instalments, paid amounts and deadlines are connected to venue and supplier items. |
| Organisation | Tasks, scheduled priorities, guest readiness, RSVP/dietary details and table planning are connected in one Organise stage. |
| Continuity | Personal and partner-workspace query context is preserved across stages; real device plans are not overwritten by newly generated server fallback plans. |
| Reusable logic | Planning, budget, supplier, payment and workspace rules live outside page components and can support a future native client. |
| Safe beta | The Planning Hub remains on separate no-index beta routes and the public planners remain available. |

## Prepared but not enabled

Secure partner sharing and cloud persistence have local application foundations
and dormant database migrations, ownership checks, grants and RLS policies.
The unchanged migrations and transaction-safe RLS scenario now pass against an
embedded PostgreSQL engine with real roles, grants, policies and `auth.uid()`
claims. They have not been applied to production or to a paid Supabase branch.
The cloud feature remains disabled until the Supabase Auth/Data API boundary is
also exercised in a free local stack or approved disposable environment.

Additional supplier catalogues are structurally ready but remain manual-only.
Each catalogue still needs enough real published listings, approved imagery,
its public profile route and category-specific browser verification before its
`live` flag can change.

## Remaining release gates

1. Run the already-passing collaboration scenario through Supabase Auth and the
   Data API with the guarded `npm run test:planning-api` harness in a free local
   stack or approved disposable environment. The database-level owner, partner,
   outsider and anonymous cases now pass.
2. Review the accumulated local commits as a release series and choose the
   production scope.
3. Complete physical iPhone/Safari and Android touch testing; automated 390px
   Chrome verification is already passing.
4. Keep the development-only ESLint dependency advisory under review. The
   production dependency audit is now clear; forcing npm's suggested fix would
   incorrectly downgrade the Next.js ESLint configuration.
5. Obtain explicit approval before any push, pull request, migration,
   deployment, production write or rollback.
6. After an approved release, collect field Core Web Vitals, especially INP,
   because Lighthouse cannot provide a representative field INP measurement.

## Current verification baseline

- 62 test files and 283 tests passing.
- Embedded PostgreSQL RLS verification passing for 8 migrations and 10
  user-owned tables, including schema-contract assertions and transaction-safe
  owner, partner, outsider, invitee and anonymous scenarios.
- TypeScript passing.
- ESLint passing with one unrelated pre-existing `<img>` warning in the venue
  Open Graph image route.
- Optimized Next.js build passing with 78 generated pages.
- Production dependency audit passing with zero known vulnerabilities after
  patching Next.js, Sharp, PostCSS, MCP SDK and their affected transitives.
  The full audit retains only a development-tool ESLint/minimatch advisory.
- Sharp 0.35.3 image processing verified with the application's supported
  rotate, flatten, resize and JPEG pipeline on Node.js 24.
- Supplier roadmap and manual supplier stage verified at 390 x 844 with no
  horizontal overflow, no browser errors and zero axe violations.
- Planning Hub home navigation verified at 390 x 844 with no horizontal
  overflow, modal obstruction or browser errors.
- Venue and photographer details now retain a 96px sticky-header focus offset;
  their 44px close controls remain unobstructed and return focus to the exact
  opening control.
- Open venue details, open photographer details and Organise each pass axe-core
  with zero violations and zero incomplete checks.
- Three supplier-roadmap Lighthouse mobile runs: performance 98,
  accessibility 100, best practices 100, LCP 2.243-2.249 seconds, CLS 0 and
  total blocking time 70-80 milliseconds.

No production data, hosted Supabase migration, cloud branch, deployment or paid
action was used.
