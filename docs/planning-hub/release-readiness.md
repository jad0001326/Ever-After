# My EverAft Planning Hub release readiness

Date: 29 July 2026

Status: locally complete as a connected, local-first beta; production release
and connected partner sharing remain gated.

This record maps the original objective to current evidence and defines a
reviewable release sequence for the local commits on
`codex/planning-hub-venue-slice`. It is a release plan, not permission to push,
deploy, migrate or enable cloud persistence.

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
| Supplier discovery | Photography is live with server filtering and pagination. Fifteen further categories expose truthful manual planning and make no catalogue request until activated. Venue, photography and supplier items track user-confirmed availability for the exact wedding date and stale that result when the date changes; the directory never claims calendar knowledge it does not hold. | Proven locally |
| Bookings and payments | Booking overview, deposits, instalments, paid totals, due dates, overdue states, date-readiness and upcoming priorities are connected to plan items. Long plans reveal every booking in six-item batches and every payment in five-item batches. | Proven locally |
| Tasks, guests and tables | The Organise stage reuses the seating engine and adds complete task lifecycle management, scheduling, RSVP/dietary readiness and table-plan continuity. | Proven locally |
| Secure partner sharing | Hashed single-use email-bound invites, owner/partner roles, narrow server actions, conflict tokens and RLS pass in PostgreSQL. The feature flag remains off pending Auth/Data API verification. | Prepared and gated |
| Native-ready business logic | Budget, recommendation, supplier, payment, task, guest, seating, validation and cloud mapping rules live outside page components and use stable DTOs. | Proven as an architectural foundation |
| Public planner safety | Public Budget and Table Planners remain at their existing routes; the beta is separate, unlinked and no-index. Existing planner regression tests and the optimized build pass. | Proven locally |
| Mobile performance | Three production-build Lighthouse runs score 98 performance, 100 accessibility and 100 best practices, with LCP 2.243-2.249 s and CLS 0. | Target met in lab |
| Interaction performance | Immediate local state and small client boundaries are in place; lab TBT is 70-80 ms. Real INP requires post-release field traffic. | Awaiting field evidence |
| Keyboard and screen reader access | Semantic landmarks, labelled status regions, pressed/expanded states and focus return are present. Release-candidate keyboard checks and axe scans pass at 390 x 844. | Proven locally |
| User-record security | Ten user-owned tables have RLS, explicit grants, owner/member predicates and anonymous denial. The eight-migration sequence passes the embedded PostgreSQL scenario, including denial of partner access to unlinked owner budgets and workspace budget relinking. | Database boundary proven |

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
| 24. Complete selection lifecycle | Add confirmed removal and safe reactivation for venue, photography and generic supplier plan items, including selected-venue clearing and inactive result-card handling. | Current working slice | Versioned plan JSON and the existing protected whole-plan save only; no schema, grant or cloud activation. |

The existing `173874f` merge brings `origin/main` commit `225e25b` into the
series between reviews 1 and 2. It does not add a separate Planning Hub change.

## Database order

The application must not infer remote migration state from the presence of a
table. Before approval, compare the remote migration history with these files.
Supabase applies unapplied files in timestamp order:

1. `20260723092444_create_budget_plans.sql`
2. `20260723093146_tighten_budget_plan_grants.sql`
3. `20260723093318_scope_budget_plan_ids_to_user.sql`
4. `20260726140200_planning_workspace_foundation.sql`
5. `20260726162254_planning_workspace_snapshot_import.sql`
6. `20260726164304_planning_workspace_profiles.sql`
7. `20260726185032_planning_workspace_partner_budgets.sql`
8. `20260726191406_planning_table_plan_sync.sql`

The first three describe the existing owner-scoped `budget_plans` design.
Remote migration history must decide whether they are already applied; do not
replay or repair history by assumption. The five workspace migrations are
additive and remain dormant while `PLANNING_WORKSPACE_CLOUD_ENABLED` is absent.

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
   - obtain approval before pushing or creating stacked pull requests;
   - review each boundary above in order;
   - merge no migration automatically.
3. **Free Supabase boundary verification**
   - run `npm run planning-api:prepare-local` to generate the reproducible
     checksummed test project described in
     `docs/planning-hub/api-verification.md`;
   - use a local full stack once a container runtime is available, or an
     explicitly approved no-cost disposable environment;
   - confirm that the eight Planning Hub migrations above apply in timestamp
     order over that baseline;
   - create owner, partner, outsider and unmatched invitee Auth users;
   - run reads and mutations through `supabase-js` and the REST boundary;
   - prove invitation redemption, RLS denial and stale-version conflicts;
   - run database advisors and retain the output.
4. **Production preflight, only after approval**
   - take or confirm a recoverable database checkpoint;
   - list local and remote migration history and stop on any divergence;
   - inspect the exact pending SQL and advisors;
   - confirm the cloud flag is still absent.
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
  Docker, Podman, the Supabase CLI, `psql` and a WSL distribution are absent.
- The guarded `npm run test:planning-api` harness and disposable baseline
  generator are ready. The generated 27-file stack still needs its first
  container-runtime execution.
- Physical iPhone/Safari and Android touch behavior needs real devices.
- Fresh rendered computed-style verification must confirm the local sans stack
  on a public page and Planning Hub page. The in-app Browser control runtime was
  unavailable during the code-level correction, so no substitute browser result
  is claimed.
- Fresh rendered mobile verification must exercise the new date-availability
  control, stale-date warning, Organise command-centre summary and long-list
  booking/payment expansion, plus confirmed item removal and reactivation.
  Component, domain, workspace persistence and recommendation behavior are
  covered, but the in-app Browser control runtime remained unavailable for
  these slices.
- Field INP requires an approved release and real traffic.
- Push, pull-request creation, migration, deployment and production writes all
  require explicit approval.

## Final local release-candidate evidence

- 65 Vitest files and 311 tests pass.
- The embedded PostgreSQL verifier passes all eight migrations and ten
  user-owned-table assertions, including denial of partner reads against an
  unlinked owner budget, denial of workspace budget relinking, partner task
  deletion and outsider task-deletion denial.
- TypeScript passes.
- ESLint has zero errors and retains one unrelated pre-existing Open Graph
  `<img>` warning.
- `npm audit --omit=dev` reports zero known vulnerabilities.
- The optimized Next.js 16.2.12 build produces 78 pages.
- The global body font now resolves through a local system sans stack rather
  than an undefined custom property or a remote font request; its stylesheet
  contract has focused regression coverage.
- Every planned venue or supplier can record whether availability has not been
  checked, an enquiry was sent, or the business is available or unavailable for
  the current wedding date. A date change invalidates the earlier answer, and
  Organise shows aggregate available, awaiting, unavailable and action-needed
  counts, labels every booking, progressively reveals long plans in six-item
  batches, and prioritises confirming or replacing the affected option. Legacy
  plans restore as not checked.
- Organise initially renders five scheduled payment commitments, then exposes
  every later deadline and its exact payment-editor link in five-item batches.
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
- The local API generator reproduces one baseline plus all 26 timestamped
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

The browser verification used only the existing Supabase URL and publishable
key for read-only catalogue access. The service-role key was not loaded.

No paid resource, cloud branch, deployment, migration or production write was
used to create this release record.
