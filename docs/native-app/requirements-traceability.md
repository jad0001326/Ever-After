# Native app requirements traceability

Date: 1 September 2026 (original planning matrix: 20 August 2026)

This matrix audits the native plan against the active EverAft goal. It is an
acceptance map, not evidence that the app has been built. `Plan complete` means
the product behavior, implementation slice and proof have been specified.
`Implementation pending` remains the status until the named evidence actually
passes in the relevant PR or release environment.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| Existing foundation | Current main contains reusable behavior or a dormant boundary; the implementation PR must still prove safe reuse |
| Plan complete | The approved local documents define behavior, ownership and verification |
| Implementation pending | Native/runtime work and its evidence have not yet been produced |
| Separate workstream | Required by the wider EverAft goal but not implemented by the couple native client |
| External approval | Production, remote database, distribution, outreach, paid service or commercial action remains separately gated |

## Connected couple journey

| Goal requirement | Product/screen owner | Implementation slice | Required proof | Current status |
| --- | --- | --- | --- | --- |
| Create/resume a wedding profile and enter budget, date, guests, Scottish location and priorities | Onboarding; You > Wedding profile | N4 device-first, N6 connected setup | Restart/offline recovery; calculation parity; two-client transactional setup rollback/version tests | Plan complete; implementation pending |
| Discover venues through fast server filtering without downloading the catalogue | Discover > Venue search | N5 | Eight-result bounded payload, deterministic pagination, filter and slow-network tests | Existing query foundation; implementation pending |
| View truthful venue details and photography on demand | Venue detail/gallery | N5 | Internal-test denial; approved/representative/absent fixtures; gallery loads only on detail | Existing catalogue foundation; implementation pending |
| Save, compare, shortlist and select with distinct meanings | Venue card/detail/compare; Plan item | N5–N6 | Bookmark RLS, three-item compare persistence, unique shortlist and selected-venue invariants | Existing domain foundation; implementation pending |
| Record estimated, quoted, booked, partially paid and paid states | Plan > Budget item | N6 | Shared web/native calculation parity and status transition fixtures | Existing budget domain; implementation pending |
| Update committed, paid and remaining budget immediately | Today; Budget | N6 | Optimistic response under native tap budget plus canonical server reconciliation | Existing budget domain; implementation pending |
| Track deposits, payments, instalments and deadlines | Budget item; Payments; Today | N6 and N8 | Total/over-allocation/date invariants, offline replay and overdue boundaries | N8B implemented and unit/emulator verified; connected preview and distributed-device gates pending |
| Recommend the next logical action, with photography after venue selection | Today recommendation | N6–N8 | Venue-to-photography transition plus overdue payment/task precedence | N8B payment/task precedence and exact deep links implemented and tested; distributed-device gate pending |
| Discover photographers using venue, location and remaining budget while not inventing availability | Discover > Photography | N7 | Live-category enforcement, stale-venue response, budget/location context and unchecked-date state | Existing supplier foundation; implementation pending |
| Preserve manual entry where catalogue coverage is thin | Venue/photography empty results; Budget add item | N5 and N7 | Manual entry creates one valid planning item and survives offline reopen | Existing domain foundation; implementation pending |
| Manage tasks | Plan > Tasks; Today | N8 | Stable-ID retry, collision, lost-response and idempotent CRUD tests | N8A merged in PR #78 with device/connected CRUD and recovery tests; distributed-device gate pending |
| Manage guests and table arrangements | Plan > Guests/Tables, with web handoff until parity | N9 | Seating invariants, accessible linear editor, sensitive-log scan and two-device conflicts | N9A typed hydration, safe conflict recovery, privacy-safe summaries, exact routes and web handoff implemented and locally verified; N9B/N9C editors, two-device and physical-device gates pending |
| Share securely with one partner | You > Partner; invitation deep link | N10 | Owner/partner/outsider RLS, concurrent invite/accept, redaction, removal and reconnect purge | Dormant schema foundation; hardened implementation pending |
| Export personal data and delete an account safely | You > Privacy and data/Delete account | N12 | Scoped export, expiry denial, fresh auth, shared-plan outcomes, Storage cleanup, session denial and retry | Plan complete; implementation pending |

## Experience, performance and accessibility

| Goal requirement | Architecture decision | Implementation slice | Required proof | Current status |
| --- | --- | --- | --- | --- |
| Genuine planning product rather than directory beside calculator | Today/Discover/Plan share one workspace and decision-state model | N4–N9 | Golden journey from setup through venue commitment, budget change and next action | Plan complete; implementation pending |
| Weekly return value | Today surfaces one reasoned action, closest payment/task deadline and progress | N6–N8 | Recommendation correctness plus useful-return product metric | N8B closest task/payment and recommendation routing implemented and tested; live product metric pending |
| Small iPhone usability | Four tabs, full-height filter sheets, single-column critical flows, 44-point targets | N2 and every feature PR | Current small-iPhone physical/simulator matrix with Dynamic Type | Plan complete; implementation pending |
| Screen-reader and keyboard accessibility | VoiceOver/TalkBack-native controls; accessible linear table/compare alternatives; keyboard-safe web handoffs | N2, N5, N9, N12 | VoiceOver/TalkBack golden journeys, focus/error checks and WCAG AA contrast | N9A count summaries, 44-point actions and named external handoff implemented; native linear editor and physical VoiceOver/TalkBack gates pending |
| Native responsiveness | Cached useful screen under 1s, connected content under 2.5s, local tap response under 100ms | N2 baseline; N4–N12 enforcement | Physical-device launch/render/interaction traces, separately reported by platform | Plan complete; implementation pending |
| Web performance remains protected | Lighthouse 90+, LCP <2.5s, INP <200ms, CLS <0.1 | N1 baseline and N12 release repeat | Comparable production-mode Planning Hub run before/after shared extraction | Plan complete; implementation pending |
| No unnecessary rerenders or unbounded media/data | React-free domain, isolated stores, virtualized lists, eight cards, on-demand galleries | N1, N2, N5, N7 | Render profiling, payload assertions and list update isolation | Plan complete; implementation pending |
| Existing public planners stay safe | Next.js remains root; compatibility exports; native rollout is additive and gated | N1–N12 | Unchanged web build/tests and explicit web handoff until native parity | Plan complete; implementation pending |

## Security, data and release control

| Goal requirement | Planned control | Implementation slice | Required proof | Current status |
| --- | --- | --- | --- | --- |
| Reuse one backend and shared business logic | `planning-domain`, `planning-contracts` and typed HTTPS API client | N1–N3 | Portability boundary, schema alignment and web/native parity | Existing reusable code; implementation pending |
| Correct ownership and RLS for every connected record | Caller bearer identity, RLS final boundary, non-enumerating errors | N3, N6, N9, N10 | Real Auth/Data API owner/partner/outsider/anonymous matrix | Current planning RLS verifier passes; remote activation pending |
| Safe database change and rollback | [Allowlisted release manifest](backend-change-plan.md), isolated workspace sequence, preflight, forward correction and disabled client use | N6/N10 | Live-ledger equality, exact dry run, advisors, transactional/RLS harness and recovery notes | Plan complete; external approval required |
| Secure offline behavior | Encrypted session boundary, protected SQLite, semantic queue and cache isolation | N3, N4, N11 | Physical-device storage tests, airplane/killed-app replay and account-switch scans | Plan complete; implementation pending |
| No unauthorized operational change | Separate approvals for commit, push, preview/build, migration, flag, merge/deploy and distribution | Every slice | Recorded approval plus post-action verification | Active constraint |
| No supplier contact or outreach side effect | Couple actions save/select locally or through planning APIs; N10 uses OS share only | N5, N7, N10 | Network/action audit proves no email, supplier contact or outreach mutation | Plan complete; implementation pending |
| No unapproved paid infrastructure | Local simulator/device and existing services first | N2 and N12 | Dependency/cost review before hosted builds, stores or monitoring | External approval |

## Competitive and supplier-network alignment

| Wider-goal requirement | Native contribution | Source-of-truth workstream | Gate |
| --- | --- | --- | --- |
| Prove connected planning rather than imitate directory breadth | Venue decision changes budget and next action; photography follows contextually | Couple Planning Hub | Venue-first golden journey passes before adding breadth |
| Activate supplier categories only when useful and truthful | One reusable category UI/API; photography first; manual fallback | Supplier catalogue/readiness | Published coverage, truthful imagery, filters, full profiles and mobile verification |
| Preserve explicit catalogue/research/outreach states | Native consumes published/live catalogue only and never exposes staging/admin fields | Supplier network/admin tooling | Category API denies dormant/draft data; production publication remains separate |
| Generalise claimable profiles and owner self-service | No supplier/admin native app in MVP; couple client remains compatible with public supplier profiles | Supplier claim and owner portal, including separately gated PR #69 | Reviewed claim safety, production migration and owner self-service evidence |
| Do not invent supplier pricing or billing | Native displays only source-backed listing price cues and planning values | Commercial proposition | Explicit commercial approval before tiers, billing or public pricing |
| Keep Scottish content connected to action | Relevant guidance may deep-link to setup, comparison, budget or next action; no generic feed | Web content/SEO plus Planning Hub | Content is published only when the linked planning action is real and public |
| Track Scottish Wedding Club claims cautiously | No runtime dependency or imitation requirement | Future read-only competitive checkpoint | Recheck primary sources before commercial decisions or September campaign conclusions |

## Planning-pack completion check

The local planning deliverables are complete only when:

1. architecture owns every data, security, performance and release boundary;
2. the MVP specification defines the user outcome and all material states;
3. the screen map gives each outcome a reachable small-screen surface;
4. the responsive wireframes prove the action hierarchy and reading order at
   compact and expanded widths;
5. the backend change plan classifies every API/database dependency and defines
   an allowlisted application and forward-recovery path;
6. N0–N12 assign every implementation change, proof and approval boundary;
7. the decision log records every settled choice, rejected alternative and
   evidence-dependent decision deadline; and
8. this matrix has no native MVP requirement without all four mappings.

That completes planning, not the app. Runtime rows remain `Implementation
pending` until their named evidence exists. Production migrations, flags,
deployments, supplier publication/outreach, paid services and distribution must
never be inferred from a green local planning check.
