# My EverAft Planning Hub release readiness

Date: 3 August 2026

Status: locally complete as a connected, local-first beta. Draft pull request
#55 and its authentication-protected Vercel preview are current through pushed
commit `c3a01c9`; seven later supplier-research, generic-outreach, migration-
alignment, risk-review, public-positioning, release-verification and release-
safety commits remain local and unpushed. Production release and connected
partner sharing remain gated. The approved
read-only production database preflight is recorded in
`docs/planning-hub/production-preflight-2026-08-03.md`; it found migration
timestamp drift and legacy Data API grants. The repository now mirrors all 25
recorded production migration identities locally, so no production history
rewrite is expected; nine reviewed migrations remain pending activation.
The exact approval, dry-run, no-cost checkpoint, stop and rollback sequence is
recorded in `docs/planning-hub/production-activation-runbook.md`.
The nine-file lock, data-rewrite and existing-row surface is separately
recorded in `docs/planning-hub/pending-migration-risk-review-2026-08-03.md`.

The competitive priority adjustment in
`docs/planning-hub/competitive-priority-update.md` now favours activation
readiness, recurring couple value and truthful public positioning over adding
more dormant API surface. This does not authorise a homepage launch, supplier
category activation, push, deployment, migration or production write.

Launch-ready public positioning is prepared behind
`PLANNING_HUB_PUBLIC_ENTRY_ENABLED=false`. The default homepage now describes
EverAft through Scottish wedding discovery and the currently public budget and
table tools; the Planning Hub CTA and navigation remain absent until a separate
post-smoke approval flips that server-side entry flag.

The supplier clarification in `docs/planning-hub/supplier-network-roadmap.md`
makes catalogue acquisition, public category profiles, verified claiming and
useful owner self-service part of the active delivery goal. Photography remains
the only locally enabled catalogue. No historical supplier count is accepted
as a current activation baseline.

The next cross-category acquisition blocker is also removed locally. Outreach
campaigns can carry a validated supplier category, use the matching generic or
canonical Photography claim route, and retain the existing legal-basis,
suppression, frozen-recipient and explicit-send checks. The schema change is
additive: historical Photography campaigns are not rewritten, and the new
category interface stays hidden behind
`SUPPLIER_CATEGORY_OUTREACH_ENABLED=false` until the migration is applied and
verified. The underlying draft and send functions enforce the same gate, so a
non-admin caller or stale draft cannot bypass the disabled category. No
campaign was created or sent.

This record maps the original objective to current evidence and defines a
reviewable release sequence for the commits on
`codex/planning-hub-venue-slice`. The user approved pushing that branch and
opening draft pull request #55. This record is not permission to merge, create
a production deployment, migrate or enable cloud persistence.

## Requirement evidence

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Responsive Planning Hub shell | Separate no-index `/planning-hub` routes, shared stage header, loading shell and 390 x 844 browser checks. | Proven locally |
| Wedding profile | Budget, date, guests, location, priorities and vision are validated outside React and drive recommendations. Profile component and domain tests pass. | Proven locally |
| Server-side venue discovery | `src/lib/planning-hub/venues.ts` selects narrow fields, filters on the server and returns eight-row pages. | Proven locally |
| Venue details and photographs | Detail and approved gallery queries run only after an item is opened; image dimensions and responsive sizes are retained. | Proven locally |
| Save, shortlist and compare | Saved favourites, planned items, selected venue and transient three-item comparison remain distinct. Focus returns to the opening control when detail closes. Venue and supplier selections can be removed through inline confirmation and the catalogue option returns to an addable state. | Proven locally |
| Planning states and budget | Researching, shortlisted, quoted and booked states plus derived estimated, partially paid and paid states use the shared budget calculation layer. | Proven locally |
| Immediate budget update | Venue and supplier edits update local plan totals without a page navigation; owner cloud saving remains a transition. Calculation and workspace tests pass. | Proven locally |
| Logical next recommendation | Wedding state selects venue, photography, supplier, guest, table, task or payment actions through reusable domain functions. | Proven locally |
| Supplier discovery | Photography is live with server filtering and pagination. Live searches inherit the selected catalogue venue, Wedding Profile location and remaining plan budget unless explicitly overridden; manual venue IDs are excluded and derived values are recalculated across pagination. Fifteen further categories expose truthful manual planning and make no catalogue request until activated. Venue, photography and supplier items track user-confirmed availability for the exact wedding date and stale that result when the date changes; the directory never claims calendar knowledge it does not hold. Source-backed research can be batch-staged and reviewed without publishing; two five-record official-source videographer batches now prove the real CSV boundary and broaden north/east evidence without supplying unlicensed imagery. | Proven locally; videography remains inactive |
| Public supplier profiles and claiming | Category-neutral collection, profile and claim routes are locally prepared behind the existing `live` gate. Photography retains canonical legacy URLs. Claims validate category, published identity and ownership; pending/rejected hero imagery is excluded and representative imagery is labelled. Active approved claim members can submit bounded profile proposals for atomic admin review without controlling publication, ownership, category, featuring or imagery. Other categories remain inaccessible because they have no current coverage and their flags remain off. | Foundation and owner review loop proven locally |
| Bookings and payments | Booking overview, deposits, instalments, paid totals, due dates, overdue states, date-readiness and upcoming priorities are connected to plan items. Long plans reveal every booking in six-item batches and every payment in five-item batches. | Proven locally |
| Tasks, guests and tables | The Organise stage reuses the seating engine and adds complete task lifecycle management, scheduling, RSVP/dietary readiness and table-plan continuity. | Proven locally |
| Secure partner sharing | Hashed single-use email-bound invites, owner/partner roles, narrow server actions, conflict tokens and RLS pass in PostgreSQL. The feature flag remains off pending Auth/Data API verification. | Prepared and gated |
| Native-ready business logic | Twenty-six declared budget, recommendation, workspace-discovery, dashboard/update-contract, supplier, profile, task, guest, seating and validation modules pass an executable boundary that forbids React, Next.js, browser storage, Node runtime and Supabase adapters. Recommendation decisions use stable platform-neutral targets; only the web adapter produces URLs. Strict JSON-safe facades, fifteen checked Draft 2020-12 schemas and dormant authenticated adapters expose workspace/dashboard/profile/task/full-table-plan reads plus conflict-safe profile, task, budget and atomic table-plan writes to future clients. | Complete current resource foundations proven locally |
| Public planner safety | Public Budget and Table Planners remain at their existing routes; the beta is separate, unlinked and no-index. Existing planner regression tests and the optimized build pass. | Proven locally |
| Mobile performance | Fresh full-milestone Venue-route runs score 99/98/99 performance, 100 accessibility and 100 best practices, with 2.227-2.395 s LCP and CLS 0. | Target met in lab |
| Interaction performance | Immediate local state and small client boundaries are in place; fresh Venue-route median lab TBT is 34 ms. Chrome Event Timing measures five real keyboard interactions with a 16 ms slowest duration and fails above 200 ms. Real INP still requires post-release field traffic. | Target met in lab; awaiting field evidence |
| Keyboard and screen reader access | The repeatable 390 x 844 gate uses native Enter, Space and Tab input for detail focus, close-and-return, comparison, manual entry and the Photography handoff. Chrome's full accessibility tree proves unique banner/main landmarks, named navigation/filter/result/plan landmarks, heading levels, state properties and transported context; axe remains clear. | Proven locally |
| User-record security | Ten planning tables plus supplier update requests have RLS, explicit grants, owner/member predicates and anonymous denial. The planning sequence and dedicated supplier-owner scenario pass in embedded PostgreSQL, including denial of direct owner publication and atomic admin-only supplier review. | Database boundary proven |

## Stacked review sequence

These are stacked review boundaries: each group is reviewed and merged only
after the preceding group. The commit ranges describe the current local history;
they do not require rewriting or pushing it.

| Review | Purpose | Current commits | Approval notes |
| --- | --- | --- | --- |
| 1. Persistence and venue beta | Owner-scoped plan history, stable public discovery and venue-first Planning Hub. | `c1c6b44` through `7b1e3ba` | Confirm the three historical budget migrations already match remote migration history before any database command. |
| 2. Photography | Connect live photographer discovery and planning. | `55de35d` | Application-only; cloud flag remains off. |
| 3. Local Organise | Add tasks, guests and reused table planner plus the dormant workspace schema. | `13b6f80` | Review the foundation migration separately even though activation remains off. |
| 4. Workspace security | Add gated cloud actions, protected invitation redemption, safe cloud adapter and explicit import. | `9b4fdaa` through `3926c2a` | No flag change and no migration application. |
| 5. Profile and shared routing | Add Wedding Profile, partner-safe routing, shared task/profile sync and atomic guest/table sync. | `27e76eb` through `3a1911f` | Includes four additive workspace migrations after the foundation migration. |
| 6. Payments | Add instalment schedules and retain reproducible performance evidence. | `bbe1283` through `4580584` | No schema change. |
| 7. Supplier platform | Generalize catalogue and budget logic, gate category routes and preserve workspace continuity. | `03f3051` through `c5601a9` | Only photography is marked live. |
| 8. Planning command centre | Surface payment priorities, scheduled tasks and budget/booking overview. | `0ce7ddc` through `17611e0` | Application and local workspace changes. |
| 9. Readiness and roadmap | Add guest readiness and truthful 16-category roadmap. | `b34a699` through `67f8a41` | Manual-only stages must remain catalogue-query free. |
| 10. Security proof | Add embedded PostgreSQL verification and correct the dormant profile import migration ambiguity. | `16b4534` | Must remain adjacent to the workspace migrations it verifies. |
| 11. Dependency security | Patch production dependencies and record the residual dev-tool advisory. | `d9168c2` | Production audit is zero; do not run the forced ESLint downgrade. |
| 12. Release audit | Correct gate messaging, perform final keyboard QA and record this release sequence. | `b048ef1` | Local commit only until push approval. |
| 13. API verification | Add the fail-closed Auth/Data API smoke harness and document its local baseline prerequisite. | `21fbb84` | Dormant until a free prepared test stack exists. |
| 14. Local API bootstrap | Generate a checksummed disposable project from the exact baseline plus all timestamped migrations. | `11d4a1c` | Local files only; requires a future container-runtime smoke test. |
| 15. Desktop release audit | Verify the production bundle at 1440 x 900 and correct public-planner and shared-table accessibility findings. | `dca9652` | Local commit only; no hosted action. |
| 16. Partner budget-link hardening | Prevent a partner from relinking a shared workspace to another owner budget and extend both database and future Data API assertions. | `b9b564b` | Dormant migration and local verifier only; no hosted action. |
| 17. Integrated journey continuity | Verify the complete mobile local-device journey and prevent a newly generated Organise fallback from overwriting the couple's real plan. | `5331077` | Application, regression test and local browser evidence only; no hosted action. |
| 18. Cross-site typography audit | Restore a valid local sans-serif stack after the remote font loader was removed and protect the global CSS contract. | `6747b3b` | Public and beta stylesheet change with no network font dependency; fresh rendered computed-style verification remains required. |
| 19. Date-aware supplier planning | Track explicit date availability across venue and supplier items, stale prior answers when the wedding date changes and prioritize truthful follow-up recommendations. | `280ac1b` | Application and versioned JSON contract only; no supplier calendar claim or database migration. |
| 20. Availability command centre | Surface plan-wide date readiness and exact per-item availability in the existing Organise booking overview. | `4817bed` | Derived application view only; no new query, stored state or database change. |
| 21. Reachable booking pipeline | Progressively reveal every active booking from Organise while keeping the initial DOM bounded. | `14e2f0a` | Client presentation only; the full plan remains the existing calculation source. |
| 22. Reachable payment deadlines | Progressively reveal every scheduled commitment from Organise while keeping the initial mobile view bounded. | `b03357d` | Client presentation only; payment ordering and totals remain in the shared domain layer. |
| 23. Complete task lifecycle | Add confirmed task removal to device plans and the prepared member-scoped shared action, restoring the task locally if shared deletion fails. | `0a58be0` | Existing table, grants, RLS and server action only; no schema or cloud activation. |
| 24. Complete selection lifecycle | Add confirmed removal and safe reactivation for venue, photography and generic supplier plan items, including selected-venue clearing and inactive result-card handling. | `9fbbab6` | Versioned plan JSON and the existing protected whole-plan save only; no schema, grant or cloud activation. |
| 25. Plan-aware supplier discovery | Derive live supplier venue, location and affordable-price filters from the connected plan while retaining explicit overrides and truthful manual-venue handling. | `7a41589` | Server query and accessible filter-context changes only; no schema, catalogue activation or production data action. |
| 26. Reproducible responsive gate | Preserve the exact device-plan balance across supplier handoff and add a fail-closed local Chrome/Edge gate for mobile, desktop, overflow, browser errors and axe. | `eaa99d8` | Local application and verification tooling only; the command refuses non-loopback URLs and uses no hosted browser or production data. |
| 27. Whole-milestone browser matrix | Extend the reproducible gate across Venue, Photography, Organise and both public planners at small-iPhone and desktop release sizes. | `27c48ee` | Read-only local browser verification only; catalogue access remains read-only and every scenario uses a disposable browser profile. |
| 28. Venue-to-Photography interaction gate | Prove the signed-out favourite guard, comparison, on-demand detail, manual booked venue, exact remaining-budget handoff and device restore. | `7522107` | Local interaction verification only; no favourite or planning mutation reaches Supabase. |
| 29. Venue performance recertification | Re-measure the complete optimized Venue step after the assembled milestone and retain trace-based evidence. | `2be9c73` | Read-only local Lighthouse evidence; no application change is justified while every objective target passes. |
| 30. Native keyboard journey | Add real Enter, Space and Tab coverage for venue detail focus, close-and-return, comparison, manual entry and the Photography recommendation. | `ee105f3` | Local browser verification only; programmatic focus establishes each starting control but never substitutes for activation or sequential navigation. |
| 31. Screen-reader tree contract | Assert Chrome's rendered accessibility tree for Venue, the interactive detail/compare/manual states and transported Photography context. | `9d5c402` | Local browser accessibility inspection only; no application change is justified while the rendered semantic contract passes. |
| 32. Payment commitment round trip | Record a partial venue payment, surface it in Organise and return to the exact open payment editor with focus preserved. | `6865e1f` | Application routing, focus timing, semantic readiness panel and local browser evidence only; no schema or hosted action. |
| 33. Rendered lifecycle completion | Verify date availability and staleness, complete booking/payment expansion, focused removal, duplicate-free reactivation and the computed local font stack. | `5c255a5` | Local browser tooling and release evidence only; no application, schema, catalogue or hosted mutation. |
| 34. Upstream release sync | Merge current `origin/main`, including claimant email hardening, outreach validation and ten new planning guides, then recertify the Planning Hub release candidate. | Current working slice | Clean local merge and verification only; no remote write, migration or deployment. |
| 35. Lab interaction timing | Measure browser-generated keyboard interactions with Chrome Event Timing and fail the release gate above 200 ms. | `a6436b6` | Repeatable local lab evidence only; field INP still requires approved traffic. |
| 36. Portable planning domain | Separate recommendation decisions from web routing and guard 19 reusable domain modules against framework, browser, Node and Supabase adapter coupling. | `a3bf5a7` | Architecture and tests only; no native application, API activation or hosted action. |
| 37. Native dashboard contract | Assemble budget, payments, tasks, guests, profile readiness and the next recommendation into one versioned JSON-safe snapshot, rejecting mismatched workspace/plan joins. | `9066b3a` | Portable facade and tests only; no native application, API activation or hosted action. |
| 38. Language-neutral client schema | Define the snapshot as a strict runtime contract, generate its stable Draft 2020-12 JSON Schema and fail tests or the check command if the artifact drifts. | `e2d09e3` | Contract tooling and tests only; no native application, API activation or hosted action. |
| 39. Native authenticated read adapter | Add a versioned no-store dashboard GET route that verifies a Supabase access token and performs every read through the caller-bound RLS client. | `2b4b176` | Dormant route, refactor and local tests only; the cloud flag remains off and no hosted request, migration or data write occurred. |
| 40. Conflict-safe native budget write | Add checked request/success schemas and a dormant PATCH route that enforces the linked owner budget plus two-stage optimistic concurrency. | `b64fc9d` | Dormant route and local tests only; no schema change, hosted request, migration or data write occurred. |
| 41. Atomic native table-plan write | Add checked request/success schemas and a dormant PATCH route that preserves owner/partner access while using the existing transaction's lock and exact workspace-version check. | `f0ee532` | Dormant route and local tests only; no grant, schema change, hosted request, migration or data write occurred. |
| 42. Native wedding-profile resource | Add checked nullable resource/update schemas plus dormant GET/PATCH handlers with server timestamps and two-stage profile-version concurrency. | `20e4708` | Caller-bound RLS reads/writes and local tests only; no grant, schema change, hosted request, migration or data write occurred. |
| 43. Native task management | Add six checked contracts plus bounded list, stable-ID create, exact-version update and exact-version delete routes. | `3a5fad8` | Caller-bound workspace/task RLS operations and local tests only; no grant, schema change, hosted request, migration or data write occurred. |
| 44. Native table-plan read resource | Add a checked full resource and bounded narrow GET, returning the exact version consumed by the existing atomic PATCH. | `f98f0d5` | Caller-bound RLS reads, validator hardening and local tests only; no grant, schema change, hosted request, migration or data write occurred. |
| 45. Native workspace discovery | Add a checked bounded collection that lets authenticated clients discover their RLS-visible workspaces and caller role without exposing other members. | `d45f496` | Caller-bound RLS reads and local tests only; no grant, schema change, hosted request, migration or data write occurred. |
| 46. Competitive priority adjustment | Incorporate the Scottish Wedding Club launch review without advertising dormant functionality or weakening supplier activation gates. | `0d03317` | Goal and strategy documentation only; competitor commercial claims remain directional pending primary-source verification. |
| 47. Supplier network workstream | Make catalogue acquisition, cross-category public profiles and claims, bounded owner self-service and connected supplier decisions a first-class activation stream. | `171997d` | Planning and local audit only; no live-count claim, supplier publication, outreach, migration, deployment or paid action. |
| 48. Supplier catalogue baseline | Add a fail-closed GET-only audit and record the current category, publication, claim, imagery, provenance and profile-completeness baseline. | `17059b8` | Protected aggregate reads only; no contact data output, database write, migration, publication, outreach, deployment or paid action. |
| 49. Cross-category public supplier foundation | Add gated public collection/profile/claim routes, preserve Photography canonicals, generalize admin claim review and permission-bind supplier imagery. | `8ce8576` | Local application only; all other category flags remain off and no supplier record, claim, migration, outreach, deployment or paid service was changed. |
| 50. Bounded supplier-owner self-service | Let active approved claim members propose useful profile changes while preserving admin-only publication, ownership, category, featuring and imagery controls. | `b82e7a6` | Local application, unapplied migration and embedded PostgreSQL proof only; no hosted data, migration, deployment, outreach or paid action. |
| 51. Source-backed supplier staging | Add atomic research batches, strict provenance/pricing/image validation and bulk decisions that create draft listings only. | `dfcbb01` | Local application, template, unapplied migration and embedded PostgreSQL proof only; no real supplier research, hosted data, publication, outreach, deployment or paid action. |
| 52. Current-main integration | Merge the four current upstream commits and preserve featured-first venue ordering without losing Planning Hub query state. | `3bda64a` | The full application, security and optimized browser gates pass. The user approved updating the existing draft pull request; merge and production actions remain separate. |
| 53. First real supplier research batch | Select videography for the next research slice and add five validated primary-source candidates with explicit pricing and no unlicensed imagery. | `9676f22` | Local CSV, evidence record and regression test only; nothing imported, staged in a hosted database, published, contacted or activated. |
| 54. Production database preflight | Compare the healthy production project's migration history, table security and advisors; prepare a narrow grant hardening migration for 19 legacy tables. | `c3a01c9` | Read-only hosted audit plus local migration and disposable PostgreSQL proof; no migration, data change, branch, paid resource or activation. |
| 55. Regional videographer evidence | Add a second official-source batch for Aberdeen, Aberdeenshire, the Highlands and explicit Dundee service coverage, retaining a conflicting official price for operator review. | `3ebc805` | Local CSV, evidence and regression test only; no hosted staging, supplier contact, imagery, publication, activation or push. |
| 56. Category-aware supplier outreach | Generalize candidate filtering, recipient snapshots, claim links and send-time checks while retaining legacy Photography rows and a disabled-by-default category flag. | `79303f4` | Local application and unapplied additive migration only; no campaign, contact, hosted write, feature activation or push. |
| 57. Production migration alignment | Mirror the 25 recorded production identities, verify the exact nine-file pending set and document the dry-run/checkpoint/approval sequence. | `4b9b309` | Read-only history refresh and local filename/runbook changes only; no history repair, migration, deployment, paid resource or push. |
| 58. Pending migration risk review | Measure the existing-row, policy, lock and functional surface of the exact nine-file pending set before activation. | `9b2509f` | Read-only production counts and local review evidence only; no migration, data change, deployment, paid resource or push. |
| 59. Truthful public positioning | Lead with Scottish wedding planning while keeping the Planning Hub entry behind a separate server-side approval gate. | `1c8c8e2` | Local application, tests and browser proof only; the entry flag defaults off and no push, deployment or public activation occurred. |
| 60. Post-positioning release verification | Repeat the optimized responsive, accessibility, interaction, live-catalogue and production dependency gates after the public entry change. | `961c63c` | Read-only local and public-catalogue checks only; no service-role key, hosted write, push, deployment, migration or paid resource. |
| 61. Integrated release safety review | Enforce generic supplier activation at the mutation and send boundaries, tighten recipient references and require the reviewed older pending migration in both dry-run and approved commands. | This release-safety commit | Local code, SQL, documentation and regression checks only; no hosted write, supplier contact, push, migration, deployment or paid resource. |

The existing `173874f` merge brings `origin/main` commit `225e25b` into the
series between reviews 1 and 2. It does not add a separate Planning Hub change.

## Database order

The application must not infer remote migration state from the presence of a
table. Before approval, compare the remote migration history with these files.
Supabase applies unapplied files in timestamp order:

1. `20260726140200_planning_workspace_foundation.sql`
2. `20260726162254_planning_workspace_snapshot_import.sql`
3. `20260726164304_planning_workspace_profiles.sql`
4. `20260726185032_planning_workspace_partner_budgets.sql`
5. `20260726191406_planning_table_plan_sync.sql`
6. `20260803122711_supplier_owner_update_requests.sql`
7. `20260803130045_supplier_catalogue_staging.sql`
8. `20260803143000_tighten_data_api_table_grants.sql`
9. `20260803150000_generalize_supplier_outreach.sql`

The other 25 timestamped files now match production's recorded versions
exactly. Do not replay them or repair production history. The five workspace
migrations are additive and remain dormant while
`PLANNING_WORKSPACE_CLOUD_ENABLED` is absent; generic supplier drafting and
sending retain their separate disabled flags.

The first pending migration predates production's latest recorded version, so
the reviewed CLI dry run and approved migration command require `--include-all`.
The alignment verifier and exact dry-run list constrain it to the nine named
files; seed data and custom roles remain excluded.

Every exposed planning table has explicit authenticated grants as well as RLS.
This is required independently of its policies because Supabase is moving new
public tables to
[explicit Data API exposure](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## Approval and activation sequence

1. **Local release candidate**
   - finish tests, typecheck, lint, optimized build, 390 px keyboard/axe checks;
   - verify the production dependency audit remains clear;
   - keep the cloud flag absent.
2. **Code review**
   - review draft pull request #55 and each boundary above in order;
   - keep the pull request in draft until the intended production scope is
     agreed;
   - merge no migration automatically.
3. **Free Supabase boundary verification**
   - run `npm run planning-api:prepare-local` to generate the reproducible
     checksummed test project described in
     `docs/planning-hub/api-verification.md`;
   - use a local full stack once a container runtime is available, or an
     explicitly approved no-cost disposable environment;
   - confirm that the baseline plus all 34 timestamped migrations apply in
     order;
   - create owner, partner, outsider and unmatched invitee Auth users;
   - run reads and mutations through `supabase-js` and the REST boundary;
   - prove invitation redemption, RLS denial and stale-version conflicts;
   - run database advisors and retain the output.
4. **Production preflight, only after approval**
   - follow `production-activation-runbook.md` through its read-only CLI dry
     run and no-cost checkpoint;
   - require the exact 25 matching and nine pending identities;
   - confirm all four feature flags remain off.
5. **Application beta**
   - deploy the reviewed application with cloud sharing disabled;
   - smoke-test the existing public planners and beta local-device journey;
   - complete physical iPhone/Safari and Android checks.
6. **Schema activation, separately approved**
   - apply only the migration files proven pending by migration history;
   - repeat owner/partner/outsider Data API checks;
   - leave cloud sharing disabled if any assertion or advisor fails.
7. **Cloud sharing activation, separately approved**
   - enable the server-only flag;
   - test one controlled owner/partner workspace;
   - monitor Auth, Data API and application errors before wider invitation use.

## Rollback

Use the least destructive rollback that restores safety:

1. Remove `PLANNING_WORKSPACE_CLOUD_ENABLED` to stop connected reads, writes
   and invitations immediately while preserving local-device planning.
2. Roll the application back to the last reviewed deployment. The public Budget
   and Table Planners remain independent.
3. Keep additive tables and user data in place while investigating. Do not drop
   tables merely to roll back application behavior.
4. Revoke invitation-function execution if an invitation-specific defect is
   found.
5. Only if no real workspace data exists and a separate destructive rollback is
   explicitly approved, remove the five workspace migrations in reverse
   dependency order. Take a checkpoint first.
6. Never delete or rewrite existing `budget_plans` as part of a Planning Hub
   rollback.

## Evidence still required

- Supabase Auth and Data API execution cannot run on the current machine:
  Docker, Podman, the Supabase CLI and `psql` are absent. `wsl.exe` is present,
  but no WSL distribution or subsystem is installed.
- The guarded `npm run test:planning-api` harness and disposable baseline
  generator are ready. The generated 35-file stack still needs its first
  container-runtime execution.
- Physical iPhone/Safari and Android touch behavior needs real devices.
- Field INP requires an approved release and real traffic.
- Draft pull request #55 is mergeable through pushed commit `c3a01c9`; seven
  later local commits are not yet in the pull request. Push, merge, production
  deployment, migration and production writes require explicit approval.

## Final local release-candidate evidence

- 102 Vitest files and 488 tests pass.
- The embedded PostgreSQL verifier passes all eight migrations and ten
  user-owned-table assertions, including denial of partner reads against an
  unlinked owner budget, denial of workspace budget relinking, partner task
  deletion and outsider task-deletion denial.
- TypeScript passes.
- ESLint has zero errors and retains one unrelated pre-existing Open Graph
  `<img>` warning.
- `npm audit --omit=dev` reports zero known vulnerabilities.
- The optimized Next.js 16.2.12 build produces 90 pages after integrating
  current `origin/main` and the supplier staging/admin surfaces.
- Three fresh optimized Venue-route Lighthouse runs score 99/98/99
  performance, 100 accessibility and 100 best practices. Median LCP is 2.237
  seconds, TBT is 34 milliseconds and CLS is 0; the slowest LCP is 2.395
  seconds. The LCP is the server-rendered hero heading, route JavaScript is
  about 8.5KiB and the median total transfer is about 288KiB.
- The global body font now resolves through a local system sans stack rather
  than an undefined custom property or a remote font request; its stylesheet
  contract has focused regression coverage. The optimized browser matrix also
  confirms the computed body font resolves to the local system stack on
  Planning Hub and both public planners at mobile and desktop sizes.
- The portable-domain gate reads 26 declared modules and rejects React/Next
  imports, client/server directives, browser globals and storage, URL
  construction, Node environment access, Supabase clients and web adapters.
  The recommendation engine now returns stable platform-neutral targets; the
  existing workspace adapter preserves every tested web URL. The dashboard
  snapshot reuses those rules with budget, deadline, task, guest and profile
  summaries, round-trips through JSON, contains no URL fields and refuses a
  workspace attached to a different budget plan. Separate workspace and budget
  update timestamps retain the freshness tokens required by future
  conflict-safe writes. Its strict runtime schema
  rejects web-adapter fields; the checked Draft 2020-12 artifact has the stable
  ID `urn:everaft:planning-dashboard-snapshot:v1`, and the generator's check
  command fails on drift.
- The optimized build includes the dynamic
  `/api/planning/v1/workspaces/[workspaceId]/dashboard` route. It verifies a
  Supabase Auth access token with `getUser(token)`, then uses that same token
  on a publishable-key client for all RLS-governed records and the linked owner
  budget. Tests cover malformed and rejected tokens, temporary Auth failure,
  disabled-cloud short-circuit, generic outsider denial, successful partner
  output and mismatched-snapshot failure. A real local production HTTP request
  returned the expected no-store 503 and v1 contract header while the cloud
  flag was off.
- The optimized build also includes the dynamic
  `/api/planning/v1/workspaces/[workspaceId]/budget` PATCH route. Its checked
  request ties `plan.updatedAt` to `expectedBudgetUpdatedAt`; the handler then
  compares the loaded version and filters the eventual update on that same
  timestamp. Tests prove the server restores the workspace owner, never writes
  `user_id`, refuses another plan ID, caps payloads, distinguishes Data API
  failure from a zero-row race and returns the new strict version token. The
  built route returned the expected no-store 503 with cloud planning disabled.
- The optimized build also includes the dynamic
  `/api/planning/v1/workspaces/[workspaceId]/table-plan` PATCH route. Its
  checked request ties a complete validated guest/seating plan to the exact
  workspace version. The handler prechecks RLS-visible access and version,
  then uses the existing authenticated atomic sync transaction, which locks
  and rechecks the workspace. Tests prove partner success, generic outsider
  denial and both precheck and transaction-race conflicts. The built route
  returned the expected no-store 503 and table-plan contract header with cloud
  planning disabled.
- The optimized build also includes the dynamic
  `/api/planning/v1/workspaces/[workspaceId]/profile` GET/PATCH resource.
  Checked contracts model both an accessible missing profile and a complete
  versioned profile. PATCH rejects client timestamps and ownership fields,
  then distinguishes stale prechecks, create collisions, update races and
  generic Data API failure while preserving owner/partner RLS. The built GET
  returned the expected no-store 503 and profile contract header with cloud
  planning disabled.
- The optimized build also includes bounded task collection and item routes.
  Six contracts define the resource, page, create, update, delete request and
  delete confirmation. Tests cover partner CRUD, stable client IDs,
  workspace-bound lookup, pagination limits and two-stage update/delete
  conflicts without changing the existing web Server Actions. The built
  collection GET returned the expected no-store 503 and task-collection
  contract header with cloud planning disabled.
- The table-plan endpoint now has a checked full read resource. Five bounded
  parallel queries load only workspace identity, guests, tables, seats and
  rules, returning the exact version used by atomic PATCH. Validation now also
  rejects duplicate identifiers, duplicate occupied seats and seat indexes
  beyond actual table capacity. The built GET returned the expected no-store
  503 and table-plan resource contract header with cloud planning disabled.
- Every planned venue or supplier can record whether availability has not been
  checked, an enquiry was sent, or the business is available or unavailable for
  the current wedding date. A date change invalidates the earlier answer, and
  Organise shows aggregate available, awaiting, unavailable and action-needed
  counts, labels every booking, progressively reveals long plans in six-item
  batches, and prioritises confirming or replacing the affected option. Legacy
  plans restore as not checked.
- Organise initially renders five scheduled payment commitments, then exposes
  every later deadline and its exact payment-editor link in five-item batches.
  Each link retains the source plan-item ID and opens and focuses the matching
  venue, photography or supplier payment editor; missing items fall back to the
  Organise commitments section.
- Task removal requires inline confirmation. Device plans persist the removal;
  connected mode uses the existing authenticated record-ID delete action and
  restores the local task if that shared deletion fails. Focus returns to the
  task heading after a confirmed removal.
- Venue, photography and generic supplier selections now use one inline
  confirmation flow. Removal marks the plan item cancelled, clears a matching
  main venue, excludes the item from active totals, deadlines, shortlists and
  result-card status, then returns focus to the stable current-item heading.
  The same catalogue listing can be added again through the existing upsert
  without duplicating its retained history. Connected removal uses the existing
  authenticated whole-plan save and introduces no new mutation or migration.
- Photography and live category searches use one reusable discovery-context
  contract. A selected catalogue venue, Wedding Profile location and positive
  remaining budget become server filters only when the URL has no explicit
  replacement; manual plan-item IDs never enter catalogue matching. Device-only
  handoffs retain the venue name and wedding date as display context without
  claiming that a manual venue is a catalogue record. The derived-value
  explanations are associated with their form controls, and pagination keeps
  the original query so defaults are recalculated from the connected plan.
- Device-only handoffs transport signed remaining pence and profile location
  separately from editable search filters. The visible plan balance therefore
  remains exact after navigation, pagination, filter submission and reset,
  while a positive balance alone supplies the affordable-price filter.
- `npm run test:planning-browser` now reproduces Venue, the optimized
  Photography handoff, Organise, the public Budget Planner and the public Table
  Planner at 390 x 844 and 1440 x 900. All ten scenarios keep document width
  equal to viewport width with no browser exceptions, axe violations or
  indeterminate checks. Photography additionally proves the exact
  17,000-pound transported balance.
- The same repeatable gate then runs a signed-out 390 x 844 interaction
  journey against the read-only catalogue. It proves the favourite sign-in
  guard, comparison, on-demand venue detail, a £30,000 profile, a £5,000 booked
  manual venue, a £1,000 deposit with £500 paid, immediate £25,000 balance,
  exact Photography URL and rendered context, exclusion of manual IDs from
  catalogue filtering, and device-plan restoration after returning to Venue.
- The restored plan then passes a native keyboard journey. Enter opens the
  first venue detail and moves focus into it, Tab reaches Close, Enter closes
  and restores the exact `View` trigger, Space toggles Compare, Enter expands
  manual venue entry, Tab reaches its first field, and Enter follows the
  Photography recommendation with the exact remaining plan context. Chrome
  Event Timing records five distinct interactions; the full optimized run's
  slowest presentation is 16 milliseconds and the gate fails above 200
  milliseconds.
- Chrome's full accessibility tree then proves one banner and one main,
  named primary/stage/result navigation, named filter/result/connected-plan
  landmarks, correct H1/H2/H3 levels, chosen/Compare/disclosure states, the
  detail region and Close control, and accessible venue/date/£25,000 context
  after the Photography handoff.
- The same device plan then opens in Organise with its booking and payment
  commitment intact. `Review payment plan` returns to the exact manual venue,
  opens its payment disclosure and focuses the summary. The populated Organise
  view has zero axe violations and zero indeterminate checks; the date-readiness
  card is a named semantic section.
- The optimized 390 x 844 lifecycle journey records explicit venue
  availability for 12 June 2027, changes the wedding date to 19 June and proves
  the prior answer becomes a visible recheck warning. A valid device-only
  seven-booking/seven-payment fixture renders six and five entries initially;
  both controls reveal all seven, switch to `Show fewer`, retain zero axe
  findings and keep page width equal to the viewport.
- That journey then confirms removal, proves focus lands on the stable current
  venue heading, and opens a live catalogue venue. Removing and adding it again
  restores one active retained item with no duplicate record.
- The local API generator reproduces one baseline plus all 34 timestamped
  migrations byte-for-byte, verifies every checksum and refuses overwrite.
- The real read-only venue catalogue returns eight lightweight results at
  390 x 844 with no horizontal overflow or browser errors.
- Venue detail focus lands below the sticky header; the 44px close control is
  unobstructed and returns focus to its opening `View` button.
- Photographer detail has the same behavior and returns focus to
  `View & plan`.
- Open venue detail, open photographer detail and Organise axe-core scans each
  report zero violations and zero incomplete checks.
- One continuous optimized 390 x 844 journey retained the same plan through a
  booked venue, booked photographer, quoted manual florist, venue deposit,
  Wedding Profile, task creation and the example guest/table plan. A fresh
  Organise reload retained the £30,000 budget, three planned items, £500 paid,
  the payment deadline, one task, 12 guests, three tables and photography
  priority without horizontal overflow or browser errors.
- The integrated journey exposed an Organise startup race: its newly generated
  server fallback could have a later timestamp than the real device plan and
  overwrite that plan. Organise now explicitly marks generated fallback data,
  always restores a valid device plan over that fallback, and has a focused
  regression test for this ordering.
- Organise, the public Budget Planner, the public Table Planner and the home
  page render at 390 x 844 without horizontal overflow or error overlays.
- Venue, Photography, Suppliers, the open Organise table editor, both public
  planners and the home page render at 1440 x 900 without horizontal overflow,
  browser errors or axe violations. The home page has one contrast result that
  axe leaves incomplete; it is not a violation.
- After the public-positioning slice, the complete optimized browser gate was
  rerun against the read-only catalogue. All ten 390 x 844 and 1440 x 900
  surfaces plus the venue-to-Photography, payment, availability, long-list,
  keyboard and screen-reader journeys passed with zero overflow, browser errors
  or accessibility findings. Chrome recorded four keyboard interactions; the
  slowest presentation was 32 milliseconds against the 200 millisecond lab
  budget.
- A separate in-app Browser smoke enabled only the local public-entry flag. The
  homepage entered the private Hub, the server returned 470 matching venues
  while the UI rendered eight cards, and Blackshaw Barns opened in-place with
  four on-demand images. Mobile and desktop stayed within the viewport, the
  route retained `noindex, nofollow`, and no console warning or error appeared.
- `npm audit --omit=dev` reports zero known production vulnerabilities on the
  current lockfile.

The local browser verification used only the existing Supabase URL and
publishable key for read-only catalogue access. The service-role key was not
loaded. Anonymous in-app browser access to the hosted preview correctly
redirected to Vercel login. An authenticated deployment fetch then returned
HTTP 200 for `/planning-hub`, retained the `noindex` response/header contract,
and rendered live paginated venue results plus the connected plan. Vercel
reported no warning, error or fatal runtime logs for that deployment during the
verification window. No public bypass link was created.

No paid resource, cloud branch, migration, production write or production
deployment was used to create this release record. Draft pull request #55 and
its authentication-protected preview remain at pushed commit `c3a01c9`; seven
newer commits are local only. The production domain was not changed.
