# My EverAft Planning Hub objective audit

Date: 3 August 2026

Status: the local beta now covers the connected planning journey and is under
review in draft pull request #55. Production release and secure cloud sharing
remain deliberately gated.

## Competitive priority adjustment

The user-provided Scottish Wedding Club launch review has been incorporated in
`competitive-priority-update.md`. It reinforces connected-product depth,
weekly return value, truthful supplier activation and structured venue data as
EverAft's defensible priorities. It also exposes a public-positioning gap: the
current homepage still leads with venue and supplier discovery while the
Planning Hub remains a protected, no-index beta.

The next sequence therefore favours beta activation readiness and public proof
that matches genuinely live functionality. Further dormant native API work is
lower priority unless it removes a concrete client or release blocker. No
competitor pricing, catalogue total or campaign claim is treated as verified
commercial evidence without a fresh primary-source check.

## Delivered locally

| Objective | Current local result |
| --- | --- |
| Wedding profile | Budget, date, guest count, location and priorities drive the workspace and recommendations. |
| Venue discovery | Server-side filters and pagination return lightweight cards; details and approved galleries load on demand. |
| Venue planning | Couples can save, compare, manually add and select venues with estimated, quoted and booked states. A confirmed removal clears a matching main venue, removes the item from active totals and leaves a catalogue option available to add again. |
| Connected budget | Selections update committed and remaining budget; the budget/booking overview exposes estimates, quotes, bookings, payment progress and plan-wide date readiness, with every active item reachable in progressive six-item batches. |
| Photography next step | Selecting a venue leads into live photography discovery, comparison, manual entry and payment planning. Discovery inherits the selected catalogue venue, Wedding Profile location and genuinely remaining plan budget unless the couple sets an explicit filter. |
| Supplier breadth | A 16-category roadmap exposes photography as catalogue live and every inactive category as an explicit manual-planning stage without catalogue queries. Live category search shares the same plan-aware context contract as photography; a manual venue stays visible to the couple but its local item ID is never sent to catalogue matching. Venue and supplier items track availability against the exact wedding date rather than inferring a calendar from directory data, and every stage shares the same confirmed removal/reactivation contract. |
| Payments | Deposits, instalments, paid amounts and deadlines are connected to venue and supplier items; every scheduled commitment remains reachable through progressive five-item batches and returns to its exact open payment editor. |
| Organisation | Tasks can be created, scheduled, edited, completed and deliberately removed; guest readiness, RSVP/dietary details, table planning and supplier date-readiness remain connected in the same Organise stage. |
| Continuity | Personal and partner-workspace query context is preserved across stages; real device plans are not overwritten by newly generated server fallback plans. |
| Reusable logic | Twenty-six declared budget, supplier, recommendation, workspace-discovery, dashboard and update-contract, profile, task, guest, seating and validation modules are guarded against React, Next.js, browser storage, Node runtime and Supabase adapter imports. The web layer maps platform-neutral recommendation targets to URLs; strict versioned JSON-safe facades and fifteen checked Draft 2020-12 schemas expose workspace/dashboard/profile/task/table-plan reads plus conflict-safe profile, task, budget and atomic table-plan writes to future native presentation adapters. |
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

## Completion classification

| Scope | Classification | Evidence or boundary |
| --- | --- | --- |
| Venue-first Planning Hub milestone | Complete locally | Responsive shell, profile inputs, paginated server discovery, detail, save/compare, estimated/quoted/booked planning, connected budget and payments, Photography handoff and manual fallback all pass the optimized interaction gate. |
| Connected planning journey | Complete locally | Venue, Photography, supplier roadmap, Organise, tasks, guests, tables, availability and payment deadlines share one versioned plan and survive reload. |
| Performance and accessibility targets | Complete in current lab evidence | Three mobile Lighthouse runs meet performance, LCP and CLS targets; four native keyboard interactions measure no slower than 24 ms against the 200 ms lab budget; Chrome accessibility tree, axe, responsive overflow and optimized browser matrices pass. Field INP still requires real traffic. |
| Secure partner sharing | Prepared, not release-enabled | Application actions, migrations, rollback order and embedded PostgreSQL RLS scenarios pass. Real Supabase Auth/Data API execution still requires a free local stack or separately approved disposable environment. |
| Production release | Draft review only | The approved branch push and draft pull request #55 are complete. The existing Vercel Git integration created an authentication-protected preview automatically; no merge, production deployment, hosted migration or production write is authorised. |
| Native iPhone and Android apps | Workspace discovery, dashboard, profile, tasks, budget and full table-plan API foundation prepared | The executable portable-domain boundary, platform-neutral recommendation DTOs and fifteen versioned language-neutral schemas now have dormant authenticated read and mutation adapters. A bounded workspace collection gives signed-in clients their accessible plans and caller role without exposing other members. All adapters use the caller's RLS client; profile, task and budget writes require exact resource versions, while a bounded table-plan GET supplies the exact workspace version consumed by the existing atomic owner/partner PATCH transaction. Native application shells, physical-device QA and live Auth/Data API execution remain future gates. |

## Remaining release gates

1. Run the already-passing collaboration scenario through Supabase Auth and the
   Data API with the guarded `npm run test:planning-api` harness in a free local
   stack or approved disposable environment. The database-level owner, partner,
   outsider and anonymous cases now pass.
2. Review draft pull request #55 and its accumulated release boundaries, then
   choose the production scope.
3. Complete physical iPhone/Safari and Android touch testing; automated 390px
   Chrome verification is already passing.
4. Keep the development-only ESLint dependency advisory under review. The
   production dependency audit is now clear; forcing npm's suggested fix would
   incorrectly downgrade the Next.js ESLint configuration.
5. Obtain separate explicit approval before merging, creating a production
   deployment, applying a migration, changing production data or rolling back.
6. After an approved release, collect field Core Web Vitals, especially INP,
   because Lighthouse cannot provide a representative field INP measurement.

## Current verification baseline

- 91 test files and 452 tests passing.
- Embedded PostgreSQL RLS verification passing for 8 migrations and 10
  user-owned tables, including schema-contract assertions and transaction-safe
  owner, partner, outsider, invitee and anonymous scenarios. The partner can
  update the shared budget and delete a shared task, but cannot read an unlinked
  owner budget or change the workspace budget link; an outsider cannot delete
  that task.
- TypeScript passing.
- ESLint passing with one unrelated pre-existing `<img>` warning in the venue
  Open Graph image route.
- Optimized Next.js build passing with 88 generated pages after merging the ten
  new upstream planning guides.
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
- The repeatable optimized-build browser gate covers Venue, the Photography
  handoff, Organise, the public Budget Planner and the public Table Planner at
  both 390 x 844 and 1440 x 900. All ten scenarios have equal
  viewport/document widths, no browser errors and zero axe violations or
  indeterminate checks; Photography also proves the transported venue, date,
  location and exact remaining balance.
- That gate now appends a signed-out 390 x 844 interaction journey: favourite
  access is safely gated, a live venue compares and opens on demand, a £5,000
  booked manual venue reduces a £30,000 plan to £25,000 immediately, a £1,000
  deposit records £500 paid, the exact venue/date/location/balance reach
  Photography without a false catalogue venue ID, and the device plan restores
  after returning to Venue.
- The restored plan then reaches Organise with its booking and payment
  commitment intact. Its review link retains the exact plan-item ID, returns
  to Venue, opens the matching payment disclosure and focuses its summary.
- Rendered mobile coverage now records availability for the exact wedding date,
  changes that date and proves the old answer becomes a visible stale warning.
  Organise bounds a seven-booking/seven-payment plan at six and five entries,
  reveals every remaining item, exposes `Show fewer` controls and passes axe
  and overflow checks while expanded.
- Confirmed removal places focus on the stable current-venue heading. A live
  catalogue venue then completes add, remove and re-add in the browser while
  retaining one active plan item and no duplicate.
- The same repeatable run uses Chrome's native Enter, Space and Tab input to
  prove venue detail focus transfer, keyboard-reachable Close, exact trigger
  focus restoration, Compare pressed state, manual-entry disclosure and field
  order, and keyboard navigation to the plan-aware Photography stage. Chrome
  Event Timing records four distinct interactions; the full optimized run's
  slowest duration is 24 milliseconds and the gate fails above 200
  milliseconds. Field INP remains explicitly separate.
- The native-ready source boundary covers 26 declared domain modules and fails
  on framework directives, React/Next imports, browser globals or storage,
  URL construction, Node environment access, Supabase clients and web adapters.
  Recommendation decisions now return stable platform-neutral targets; the web
  workspace adapter alone converts those targets into Planning Hub URLs. A
  versioned dashboard snapshot reuses the same budget, payment, task, guest,
  profile and recommendation logic, rejects mismatched workspace/plan joins
  and round-trips through JSON without URLs or runtime-specific values. Its
  strict runtime validator rejects unknown web-adapter fields, while a
  generated Draft 2020-12 JSON Schema with a stable URN is checked for drift.
  Separate workspace and budget update timestamps preserve the versions future
  clients will need for conflict-safe writes.
- Checked language-neutral request and success schemas now define the first
  native mutation. The dormant PATCH adapter caps and validates the full plan,
  rejects stale versions before writing, conditions the Data API update on the
  same exact timestamp, prevents budget relinking and always restores the
  workspace owner ID. A second local optimized-server request proved the built
  write route also returns the expected no-store 503 while cloud planning is
  disabled.
- Checked language-neutral request and success schemas also define atomic
  table-plan replacement. The dormant PATCH adapter rejects invalid seating
  before reading, checks the exact workspace version and calls the existing
  authenticated transaction, which locks and rechecks the workspace before
  replacing guests, tables, seats and rules. Tests cover partner success,
  outsider denial and both stale-precheck and in-transaction conflicts.
- A checked nullable profile resource and update request now let native clients
  load, establish and replace the full wedding profile. Clients cannot supply
  timestamps or ownership fields; first-insert collisions and exact-version
  update races return conflicts. The caller-bound owner/partner RLS client
  remains authoritative.
- Six checked task contracts now expose bounded list plus complete create,
  update and delete behavior. Stable client IDs support offline continuity;
  task lookup is bound to the workspace path and update/delete require the
  exact task version in both the precheck and conditional mutation.
- A checked workspace collection gives authenticated native clients a bounded
  discovery entry point before they know a workspace ID. It returns only
  RLS-visible plans and the caller's own role, omits owner/member identities,
  and fails closed if workspace and membership results disagree.
- A checked table-plan read resource now closes the earlier native write-only
  gap. Five bounded parallel queries return the complete guest/seating state
  and exact PATCH version without loading unrelated workspace records; stricter
  validation rejects duplicate IDs, duplicate seats and seats beyond capacity.
- The first dormant native read adapter exposes that exact contract through a
  versioned dynamic GET route. It verifies the bearer token with Supabase Auth,
  performs all reads through the same caller-bound publishable-key client,
  preserves owner/partner RLS, collapses missing and inaccessible workspaces to
  one generic 404 and sends private no-store responses. The optimized built
  route was exercised locally with the cloud flag off and returned the expected
  503 before authentication or any Supabase connection.
- Chrome's full rendered accessibility tree proves unique banner/main
  landmarks, named primary/stage/result navigation, named filter/result/plan
  landmarks, correct heading levels, detail and control names, pressed and
  expanded state, and the exact venue/date/£25,000 Photography context.
- Every optimized mobile and desktop matrix surface resolves the computed body
  font to the local system sans stack, including Planning Hub and both public
  planners.
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
- Three fresh full-milestone Venue-route Lighthouse mobile runs:
  performance 99/98/99, accessibility 100, best practices 100, LCP
  2.227-2.395 seconds, median TBT 34 milliseconds and CLS 0. The LCP is the
  server-rendered hero heading; the route chunk is about 8.5KiB and the median
  full transfer is about 288KiB.

No production data, hosted Supabase migration, cloud branch, paid action or
production deployment was used. The approved branch push created draft pull
request #55, and the repository's existing Vercel Git integration automatically
created an authentication-protected preview. The production domain was not
changed.
