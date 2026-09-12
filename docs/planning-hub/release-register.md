# EverAft delivery register

Baseline rechecked 11 September 2026. This is the current delivery register;
older readiness documents retain historical evidence, not current release status.

## Release state

| Slice | Local / PR | Merged / deployed | Enabled / device verified |
| --- | --- | --- | --- |
| N8B payments and next actions | PR #79 | Remote main 1d7833be308d06b97669539ac295943b00257558; production READY verified 5 September | Current flags not re-read; historical emulator evidence is not physical-device approval |
| N9A guest/table foundation | Draft PR #80, conflict-free with green Vercel checks reverified 11 September | Unmerged | Preview page check was previously blocked by Vercel SSO; no new physical-device evidence |
| N9B guest management and recovery | Isolated candidate branch `codex/native-app-n9b-guest-management`, based on current PR #80 head `ec3139f` | Separate draft PR; unmerged and not deployed | Native guest screen, shared operations and durable budget/table/task recovery tested; emulator remains blocked by unavailable acceleration |
| September public trust slice | Uncommitted in ever-after-public-trust-sep8, codex/public-trust-venue-exclusions | Not pushed or deployed | Local pricing/copy/enquiry checks; review findings resolved; rendered and device verification pending |
| Supplier import readiness | Draft PR #67 | Unmerged | Not activated by this work |
| Supplier admin pagination | Draft PR #68 | Unmerged | Not activated by this work |
| Speed Insights | Draft PR #66 | Unmerged | No add-on activation authorized |
| Earlier supplier security alternative | Draft PR #61 | Unmerged; leave untouched | Superseding PR #69 was confirmed merged; no new migration conclusion inferred |

The primary C:/Projects/ever-after checkout contains unrelated dirty work.
Preserve it and all existing worktrees. N9B changes remain isolated.

## Native acceptance evidence and gaps

Completed local checks: domain guest operations (15 tests), native full suite
(156 tests on 8 September), guest-screen focus (8 tests on 9 September), current mobile
typecheck and guest-screen lint. These do not establish device readiness.

Guest add/bulk/search/edit/RSVP/delete are wired to the existing device-first
save provider. Offline reopen is tested with a memory storage implementation.
Cloud conflicts have mocked-provider coverage. Neither proves real account
continuity, physical-device persistence or two-client recovery.

Guest controls now use shared tokens and buttons, disclose device-only saving,
show in-flight saving and offer connection-review navigation without data writes.
Payment main actions now share the same control, with a compact heading and an
explicit record-only/no-money-transfer explanation. Shared buttons expose busy
and disabled state. Payment screen tests: 10 passed (9 September), including
retained input after a rejected save; guest regression: 8 passed after the shared
control change. Mobile typecheck passed. Payment calculations, provider writes
and existing conflict logic were not changed by this presentation slice.
Remaining: representative device/keyboard/accessibility tests,
real approved test-environment authentication and account switching, physical
iOS and Android golden journeys. Full native seating remains staged; the
existing Tables handoff must describe separate device-only plans truthfully.

## Native milestone review checkpoint — 10 September

All three findings from the independent read-only save review are resolved
locally. Connected table-plan writes now restore the device-only ownership fields
before calling protected private-SQLite storage. A real-codec regression exposed the same
inherited defect in connected task writes, so create, update and delete now use
the same safe boundary. Guest deletion confirms against the current hydrated plan
and current save callback, rejecting a changed target. Payment editing, cost
selection and back navigation are frozen while the submitted schedule is saving,
so a success message cannot describe newer on-screen edits.

Focused provider, guest and payment regressions: 31 passed. The guest confirmation
suite passed again after the final React-safe latest-value adjustment (9 tests).
Focused lint passed, mobile typecheck passed, and the milestone-wide mobile suite
passed on 10 September: 38 suites, 160 tests. These are automated local checks,
not device-readiness evidence.

Offline refresh reconciliation and account changes during pending saves remain
additional device verification gates. Connected task mutations now carry the
same revision guard as budget and table-plan writes: a late create, update or
delete response cannot restore an old connection after sign-out or a newer
refresh. The focused provider suite passed cleanly (13 tests), including a
deferred response completed after sign-out.

Offline recovery is now durable across restart for budget, table-plan and task
writes. Device payload format 4 stores account/workspace/base-version retry
metadata without duplicating guest content. Budget and table refreshes retry only
when their cloud base is unchanged; a partner/cloud change preserves the device
draft and reports a conflict. Task create, update and delete operations use the
same account-scoped journal. Repeated offline edits coalesce while retaining the
original cloud comparison point, and a create followed by delete removes the
unneeded retry. Successful or canonically confirmed writes clear their marker
through a revision-checked follow-up device write. Versions 1–3 migrate to format
4 without losing discovery choices.

After the table recovery slice, mobile typecheck, full Expo lint and the full
mobile suite passed on 11 September: 39 suites, 166 tests. After extending the
journal to budget and task writes, the focused connected-provider suite passed
20 tests, the changed provider passed lint, mobile typecheck passed, and Git's
whitespace check passed. A later broad run passed 38 of 39 suites and 171 of 172
tests; the only failure was an unchanged account-screen test exceeding its
five-second timeout during a prolonged machine stall. That account suite then
passed independently, 4 of 4 tests in 2.449 seconds. This combined evidence is
green for the changed recovery scope, but it is not a single fully green broad
run and does not establish device readiness.

Account and storage fallback copy now uses customer language rather than
"prototype" or "local build" terminology while continuing to state clearly when
cloud backup and partner access are inactive. Its four focused screen tests pass.

Runtime capability rechecked 11 September: the Android SDK, ADB and emulator are
installed under the user's local SDK directory, but they are not on this shell's
path. ADB started successfully and returned no attached devices. Emulator
acceleration again reported that the Android Emulator hypervisor driver is not
installed, and Windows HypervisorPresent remains false. No Windows settings were
changed and no emulator was launched. Physical iOS and Android verification
remains outstanding.

A later same-day device check again returned no ADB-attached Android device.
Windows detected an iPhone only through Bluetooth audio/transport profiles;
that is not a USB/trusted developer connection and cannot establish iOS runtime
readiness. The diagnostic ADB service was stopped immediately after the check.

## Ordered backlog

1. Finish the coherent Phase 1 trust milestone in
   C:/Projects/ever-after-public-trust-sep8. Profile/selector/enquiry guards,
   known-copy cleanup, shared unit-aware pricing and safe rate defaults are
   implemented locally. Independent review found two issues now fixed locally;
   focused recheck confirmed both resolved. The 633-test web suite and production build passed.
   Reuse public-trust-progress.md there.
2. Prepare the separate database-policy correction and source-backed venue
   taxonomy improvements. Hosted read-only checks found 470 public non-test
   venues, 404 with the exact import note, plus one published internal test
   venue. A 404-row before/after copy proposal is local and unapplied; remaining
   facts are not certified by stripping that note.
3. Verify N9B guest recovery, conflict choices and shared controls on devices; resolve Android
   acceleration or attach a physical Android device for runtime checks.
4. Verify connected authentication, restoration and partner lifecycle in an
   approved test environment before promoting these capabilities.
5. Inspect existing photographer/venue quality and SEO routes, then implement
   the smallest evidenced catalogue and canonical/sitemap fixes.
6. Measure production-mode performance and complete physical-device golden
   journeys before preparing the 5–10 couple private beta.

## Evidence boundaries

The updated goal includes September 8 review priorities, but no standalone
review artifact was found in this worktree. Treat those priorities as audit
questions; do not invent specific affected listings or current supplier counts.
Catalogue counts and venue/enquiry policies were inspected read-only on
8 September; detailed evidence is in the public-trust worktree. No current
Search Console, analytics or field-performance baseline has been obtained.

Local preparation is authorized. Push, merge, deployment, hosted migration,
production data/flag changes, outreach and distribution require authorization
covering the exact action. Prior approvals remain valid for their named scope.

## N9B conflict-recovery contract

This is the implementation boundary for the next local slice. A conflict must
identify whether budget, table plan or tasks need attention without exposing
guest names, contact details, dietary notes, costs or task text in diagnostics.
The recovery screen must explain that both copies are safe until the couple
makes a choice and must not present Refresh as a resolution.

**Use My EverAft copy** performs a fresh authenticated hydration, verifies that
the account still owns or shares the same workspace, persists the complete
canonical connected-planning snapshot, and clears retry markers in one protected
device write. Explicitly device-only discovery choices and preferences remain
intact.

**Keep this device copy** performs another fresh hydration immediately before
writing. It may replace cloud content only after explicit confirmation and only
with the version returned by that hydration. Budget and table writes use those
fresh versions. Each task is compared independently: an existing task uses its
fresh version, a missing intended task is created, and a pending deletion is
accepted when the task is already absent. Any later version conflict stops the
operation, retains every device retry marker and returns to the choice screen.

Both paths are revision-guarded against sign-out, account switching, a second
recovery attempt or a newer refresh. The provider clears retry markers only
after the selected cloud state is canonically confirmed and the follow-up
protected device write succeeds. Partner invitation/removal testing remains a
separate release gate; this recovery contract does not activate partner access.

Required focused evidence: budget, table and mixed-task recovery for both
choices; cloud movement between confirmation and write; sign-out/account switch
during recovery; protected-device write failure; preservation of unaffected
device data; accessible confirmation and busy-state behaviour. Physical-device
and real connected-account checks remain mandatory after automated evidence.

## N9B conflict-recovery checkpoint — 11 September

The recovery choice is now implemented locally on the You screen. A genuine
conflict no longer presents Refresh as though it could decide the outcome. It
shows two accessible choices and explains that both copies remain safe until the
couple confirms. Each choice has a separate native confirmation before work
starts.

Use My EverAft copy performs a fresh authenticated workspace lookup and hydration,
then persists the complete canonical budget, table-plan and task snapshot in one
revision-checked protected device write. Device-only discovery choices are
preserved. Keep this device copy also hydrates immediately before writing and
uses the current cloud version for each budget, table and task mutation. Mixed
task creates, updates and deletions are handled independently. A version conflict
during that operation retains the device journal and returns to the recovery
choice instead of claiming success. Both paths canonically rehydrate before
clearing retry markers.

Focused provider, recovery-model and account-screen checks passed: 3 suites,
32 tests before the mixed-task case; the provider suite then passed 28 tests
after table, sign-out, cross-account and protected-write failure coverage.
Mobile typecheck, changed-file lint and whitespace validation passed. The
milestone-wide native suite passed cleanly after the completed slice and the
real transplant onto PR #80 head `ec3139f`: 40 suites, 190 tests. Full Expo
lint also passed. Remaining contract coverage before release:
real connected-account execution and physical-device confirmation. No commit,
push, deployment, hosted write or flag change occurred.

## N9B pre-PR stack and privacy check — 11 September

The uncommitted N9B worktree contains no credential, access-token or private-plan
diagnostic additions. Sensitive-term matches were limited to the existing token
access boundary and synthetic guest email/dietary fixtures in tests; the changed
runtime has no new console or analytics logging of guest, budget or task data.

N9B is based on the original N9A commit `a986dde`, while draft PR #80 now points
to rebased commit `ec3139f` on current main. Their stable patch IDs are identical
(`0f55cf17abb50cfe7cb70dfbe614ded27a11113e`), proving the N9A change itself is
equivalent, but their ancestry differs because N8 was squash-merged. Before N9B
is committed, preserve the dirty worktree, transplant its uncommitted delta onto
`ec3139f`, and rerun the focused provider/recovery/account checks plus the native
milestone gates. No rebase, stash, commit or push was performed during this
read-only check.

A temporary-index dry run subsequently proved that every tracked N9B edit
applies cleanly to `ec3139f` with strict whitespace checking. All nine untracked
N9B files were also checked against that tree and have no path collisions. The
temporary index was deleted after verification. This removes the known transplant
uncertainty, but does not replace the post-transplant test gates or authorize the
actual worktree move, commit or push.

## N9B post-transplant milestone review — 12 September

The approved transplant completed onto PR #80 head `ec3139f`, with the original
uncommitted state retained in a local safety stash. Independent review stopped
the first commit because cold-start offline edits had no durable connection
scope and successful replay cleared markers without persisting the full
canonical cloud snapshot. It also identified documentation that overstated the
architecture's platform-protected private SQLite as app-level encryption.

The correction adds a minimal last-connected checkpoint containing only account
and workspace IDs plus budget/workspace versions. That checkpoint allows an
authenticated cold-start offline guest edit to create a correctly scoped journal.
Reconnect now replays pending work, rehydrates the complete canonical budget,
table-plan and task state, and durably saves that snapshot before clearing any
marker. Regression coverage proves cold-start offline guest replay and preserves
partner task additions/deletions across an immediate encoded offline reopen.
Documentation now consistently describes protected private-SQLite persistence.

A second edge-case review found that canonical hydration stopped after the first
100 tasks and that first-time connection briefly exposed mutation actions before
the account/workspace checkpoint existed. Hydration now retrieves every validated
page up to the 500-task device boundary, with a 101-task regression. Provider and
guest-screen guards now block mutations while that first connection establishes
scope. The API client additionally rejects task pages or records scoped to a
different workspace, and payment/task screens no longer claim a refused change
was saved. The post-correction package suites passed 8 suites and 38 tests; the native
milestone passed 40 suites and 190 tests. Package/mobile typechecks, full Expo
lint and whitespace validation passed. Web lint had no errors and retained one
unchanged image-optimization warning outside this slice.
