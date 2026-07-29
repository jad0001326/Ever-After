# My EverAft Planning Hub objective audit

Date: 29 July 2026

Status: the local beta now covers the connected planning journey. Production
release and secure cloud sharing remain deliberately gated.

## Delivered locally

| Objective | Current local result |
| --- | --- |
| Wedding profile | Budget, date, guest count, location and priorities drive the workspace and recommendations. |
| Venue discovery | Server-side filters and pagination return lightweight cards; details and approved galleries load on demand. |
| Venue planning | Couples can save, compare, manually add and select venues with estimated, quoted and booked states. A confirmed removal clears a matching main venue, removes the item from active totals and leaves a catalogue option available to add again. |
| Connected budget | Selections update committed and remaining budget; the budget/booking overview exposes estimates, quotes, bookings, payment progress and plan-wide date readiness, with every active item reachable in progressive six-item batches. |
| Photography next step | Selecting a venue leads into live photography discovery, comparison, manual entry and payment planning. Discovery inherits the selected catalogue venue, Wedding Profile location and genuinely remaining plan budget unless the couple sets an explicit filter. |
| Supplier breadth | A 16-category roadmap exposes photography as catalogue live and every inactive category as an explicit manual-planning stage without catalogue queries. Live category search shares the same plan-aware context contract as photography; a manual venue stays visible to the couple but its local item ID is never sent to catalogue matching. Venue and supplier items track availability against the exact wedding date rather than inferring a calendar from directory data, and every stage shares the same confirmed removal/reactivation contract. |
| Payments | Deposits, instalments, paid amounts and deadlines are connected to venue and supplier items; every scheduled commitment remains reachable through progressive five-item batches. |
| Organisation | Tasks can be created, scheduled, edited, completed and deliberately removed; guest readiness, RSVP/dietary details, table planning and supplier date-readiness remain connected in the same Organise stage. |
| Continuity | Personal and partner-workspace query context is preserved across stages; real device plans are not overwritten by newly generated server fallback plans. |
| Reusable logic | Planning, budget, supplier, payment and workspace rules live outside page components and can support a future native client. |
| Safe beta | The Planning Hub remains on separate no-index beta routes and the public planners remain available. |

## Prepared but not enabled

Secure partner sharing and cloud persistence have local application foundations
and dormant database migrations, ownership checks, grants and RLS policies.
The release migrations and transaction-safe RLS scenario now pass against an
embedded PostgreSQL engine with real roles, grants, policies and `auth.uid()`
claims. Partner access is limited to the linked shared budget; a database
trigger prevents partners from relinking a workspace to another owner budget.
They have not been applied to production or to a paid Supabase branch.
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

- 66 test files and 318 tests passing.
- Embedded PostgreSQL RLS verification passing for 8 migrations and 10
  user-owned tables, including schema-contract assertions and transaction-safe
  owner, partner, outsider, invitee and anonymous scenarios. The partner can
  update the shared budget and delete a shared task, but cannot read an unlinked
  owner budget or change the workspace budget link; an outsider cannot delete
  that task.
- TypeScript passing.
- ESLint passing with one unrelated pre-existing `<img>` warning in the venue
  Open Graph image route.
- Optimized Next.js build passing with 78 generated pages.
- Production dependency audit passing with zero known vulnerabilities after
  patching Next.js, Sharp, PostCSS, MCP SDK and their affected transitives.
  The full audit retains only a development-tool ESLint/minimatch advisory.
- Sharp 0.35.3 image processing verified with the application's supported
  rotate, flatten, resize and JPEG pipeline on Node.js 24.
- The release-series cross-site review found that removing the remote font
  loader had left `--font-sans` undefined. A local system sans stack now keeps
  public and beta body typography valid without adding a font request, and a
  regression test protects that global contract.
- Supplier roadmap and manual supplier stage verified at 390 x 844 with no
  horizontal overflow, no browser errors and zero axe violations.
- Date availability is part of the reusable budget-item contract for venues,
  photography and all supplier categories. The plan records not checked,
  enquiry sent, available or unavailable against the exact wedding date;
  changing that date makes the prior response stale. Organise summarises
  available, awaiting, unavailable and action-needed items, labels every
  booking, progressively reveals long plans without an unbounded first render,
  and recommends a recheck before advancing.
- Venue, photography and generic supplier planning now expose the same inline
  confirmed removal. The reusable domain mutation preserves historical costs
  and payments in the versioned plan while marking the item inactive, clears a
  matching selected venue and allows an existing catalogue item to be
  reactivated without creating a duplicate. Result cards, shortlists, totals,
  deadlines and recommendations all ignore the cancelled record.
- Photography and live supplier searches now derive venue, location and
  affordable-price context from the connected plan. Explicit URL filters win,
  plan-derived values are explained and exposed to assistive technology, and
  pagination preserves the original query rather than freezing derived values
  into the URL.
- The production-build photography handoff renders its transported venue, date,
  location and remaining budget at a true 390 x 844 viewport with document
  width equal to viewport width. Axe reports zero violations; its one
  indeterminate check is the fixed cookie-copy contrast, whose computed
  `#625f57` on white ratio is 6.38:1.
- Planning Hub home navigation verified at 390 x 844 with no horizontal
  overflow, modal obstruction or browser errors.
- Venue and photographer details now retain a 96px sticky-header focus offset;
  their 44px close controls remain unobstructed and return focus to the exact
  opening control.
- Open venue details, open photographer details and Organise each pass axe-core
  with zero violations and zero incomplete checks.
- A single optimized 390 x 844 journey retained one plan from venue discovery
  through photography, a manual florist, Organise, payment scheduling, profile,
  tasks and the example guest/table plan. After a fresh Organise reload it
  retained the £30,000 budget, all three items, £500 paid, one task, 12 guests,
  three tables and the photography priority.
- That journey exposed and fixed an Organise startup defect where a newly
  generated server fallback could overwrite a real device plan solely because
  its timestamp was newer. A focused regression now proves a server fallback
  always yields to the existing device plan.
- The 1440 x 900 production-build audit covers Venue, Photography, Suppliers,
  the open Organise table editor, both public planners and the home page with no
  horizontal overflow, browser errors or axe violations. The home page retains
  one automated contrast check marked incomplete rather than failed.
- Three supplier-roadmap Lighthouse mobile runs: performance 98,
  accessibility 100, best practices 100, LCP 2.243-2.249 seconds, CLS 0 and
  total blocking time 70-80 milliseconds.

No production data, hosted Supabase migration, cloud branch, deployment or paid
action was used.
