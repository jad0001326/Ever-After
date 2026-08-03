# EverAft supplier network roadmap

Date: 3 August 2026

Status: supplier growth is now a first-class Planning Hub workstream. This
record is based on the current local application and migration files. It does
not claim that historical catalogue counts are current and authorises no
production read, write, publication, outreach or paid service.

## Product outcome

EverAft should not become a larger disconnected directory. A useful supplier
network lets a couple discover a suitable business, compare it, preserve the
decision, understand its budget effect, check availability, schedule payments
and see the next planning action in the same workspace.

The supplier-facing counterpart is a verified, claimable profile that can
become genuinely self-service and can demonstrate useful planning intent. Paid
tiers are not required to prove this product loop and remain a separate
commercial decision.

## Current local foundation

| Capability | Current evidence | Classification |
| --- | --- | --- |
| Supplier taxonomy | Sixteen mapped directory categories share existing Budget Planner categories. | Reusable |
| Couple planning | Every known category has a connected manual stage; Photography has live catalogue search. | Reusable |
| Search and detail | Category-neutral server search returns eight lightweight results, applies plan-aware venue/location/budget context and loads approved galleries on demand. | Reusable, activated only for Photography |
| Decision flow | Shared comparison, research/shortlist/quote/booking states, availability, budget, payments and removal/reactivation behavior exist. | Reusable |
| Supplier intake | `/for-business` accepts applications across the configured supplier taxonomy and admin approval can create a category-neutral listing. | Reusable |
| Catalogue administration | Admin create, edit, status and category filtering use `supplier_listings`; Photography alone adds `photographer_profiles`. | Reusable with operational gaps |
| Data model | `supplier_categories`, `supplier_listings`, `supplier_images`, `supplier_venue_connections`, `supplier_favourites`, `supplier_claims` and claim audit records are category-neutral. | Reusable; hosted state not rechecked here |
| Public discovery | `/photographers` and `/photographers/[slug]` are the only public supplier catalogue/profile routes found. | Photography-only gap |
| Claiming | Claim storage is generic, but the public route, redirect, eligibility query, copy, admin labels and cache refreshes hard-code Photography. | Cross-category blocker |
| Supplier self-service | Claim approval creates vendor membership and marks ownership, but no supplier listing editor for the approved owner was found. | Product-loop blocker |

## Activation sequence

### 1. Measure the real baseline

Run one read-only, no-cost catalogue audit before choosing a category. Report
each category separately by:

- total, draft, published, archived and claimed listings;
- complete town/region, summary, description, services and source provenance;
- confirmed or intentionally quote-only pricing;
- approved hero image and approved gallery coverage;
- claim readiness and open claim state;
- duplicates, stale sources and records needing manual review.

Historical counts must be labelled historical. Staged eligibility, projected
post-review totals and current live publication must remain separate.

### 2. Remove the reusable public-profile and claim blocker

Build category-neutral public profile and claim routing over the existing
listing and claim tables. Preserve category validation, published visibility,
approved-image rules, authentication, duplicate-claim protection and admin
review. Replace Photography-specific labels and cache refreshes with the
validated category without breaking existing photographer URLs.

Claim approval should expose a deliberately bounded owner-editing path before
claiming is promoted as a supplier benefit. Ownership alone is not sufficient
self-service.

### 3. Choose and prepare one next category

Rank categories only after the baseline by:

1. meaningful verified Scottish coverage;
2. importance in the couple's normal post-venue plan;
3. profile and image completeness;
4. usefulness of current shared filters;
5. ability to connect price, booking and next-step decisions truthfully.

Videography, floristry, celebrants, cakes, entertainment, bridalwear and
hair/makeup are candidates, not promises. A small category with strong verified
coverage is preferable to a large weak catalogue.

### 4. Build the repeatable acquisition path

Use a source-backed staging format and batch review/import tooling. Each staged
record needs its source, research date, category, normalized identity, contact
provenance, image permission, completeness result and intended publication
state. Research is not publication; contact enrichment is not permission to
send outreach; a profile is not live until approved.

### 5. Activate the category as one complete slice

Activation includes the public category page, full profile, claim route,
Planning Hub catalogue flag, real-data empty/error/filter behavior, manual
fallback, comparison, budget/payment connection, mobile/keyboard/screen-reader
checks, sitemap/metadata decision and rollback. Do not flip only the `live`
flag.

## Category release gate

A category may become public and catalogue-live only when all of these pass:

- meaningful real published coverage, measured rather than guessed;
- lawful source provenance and no unresolved duplicate or stale-source block;
- useful location, description, services and pricing-or-quote handling;
- truthful representative imagery with approved rights;
- public list, full-profile and verified claim journeys;
- manual fallback and connected Planner behavior;
- bounded server pagination and on-demand media;
- mobile, keyboard, screen-reader, error and performance verification;
- explicit approval for any production publication, migration or deployment.

## Measures that matter

Track catalogue health (verified profiles, completeness, claim rate and stale
records), couple value (detail views, comparisons, shortlists, planned
suppliers and booking/payment progression) and supplier value (claims,
enquiries and response readiness). Raw profile count is context, not the
success measure.

## No-cost and approval boundary

Local code, documentation, dry runs and read-only audits may proceed. Do not
publish or archive supplier records, apply migrations, send invitations or
other outreach, expose pricing tiers, enable billing, push, merge or deploy
without the relevant explicit approval.

## Recommended next slice

First refresh the read-only baseline. Then implement the category-neutral
public profile and claim foundation because it removes a blocker shared by
every future category. Activate only the best evidenced next category after
that foundation and its real catalogue pass the release gate.

## Baseline completed — 3 August 2026

The first read-only audit is recorded in
`supplier-catalogue-baseline-2026-08-03.md`. It confirmed 31 published
Photography listings and no listings in the other fifteen categories. The
Photography records all have core text, location and source provenance, but
none currently passes the stricter activation gate because confirmed
pricing/explicit quote handling and permitted visual evidence are absent.
There are no claimed profiles or open claims.

The next implementation slice is therefore the category-neutral public
profile and verified claim foundation. No second category should be activated
until a source-backed staged catalogue creates meaningful verified coverage.

## Public profile and claim foundation completed — 3 August 2026

The local application now has gated public routes for a reusable supplier
category page, full profile and claim journey. Inactive categories return 404
before querying a catalogue. Photography preserves its established
`/photographers` URLs, and category-neutral Photography aliases permanently
redirect to those canonicals rather than creating duplicate pages.

The shared profile retains server-side bounded search, on-demand approved
galleries, budget handoff, structured metadata, venue connections and a direct
verified claim action. Claim submission validates the configured live
category, supplier identifier, slug, published state and existing ownership
before inserting through the signed-in user's RLS client. Admin claim review
is now category-neutral.

Supplier imagery is also permission-bound at the shared data mapper. Pending
and rejected hero images never reach public profiles, catalogue cards or the
Budget Planner; approved and representative images are allowed, with
representative images labelled visibly.

The routes are still dormant for the other fifteen categories because their
catalogues have no current records and their `live` flags remain false. The
remaining claim-product blocker is useful supplier-owner self-service after an
approved claim.

## Bounded supplier-owner self-service completed locally — 3 August 2026

An active member of an approved claimed supplier can now see that supplier in
the existing vendor dashboard and submit one complete, bounded profile proposal
for review. The form covers location, service coverage, copy, services, public
links and optional pricing guidance. It deliberately excludes business name,
category, ownership, claim state, publication, featuring and imagery.

The proposal does not edit the public listing. A separate admin queue compares
current and proposed fields, requires a reason when returning work, and uses one
security-invoker database function to lock, recheck membership and apply only
the allowed fields. Previous and applied snapshots preserve the review record.

The embedded PostgreSQL check proves active-member access, outsider denial,
anonymous function denial, owner inability to approve or publish directly,
atomic admin approval, immutable publication/ownership controls, one pending
proposal per supplier and rejection of approval after membership is removed.
This is local code and an unapplied migration only; it changes no hosted data.

Before any hosted application, compare remote migration history and take a
schema backup. If it must be withdrawn before real requests exist, remove the
review function, request table and the two added read policies in one reviewed
rollback. Once requests exist, preserve the audit records: disable submission
and review grants, revert the application routes, and use a forward corrective
migration instead of dropping the table.

## Source-backed batch staging completed locally â€” 3 August 2026

The next acquisition blocker is removed locally. `/admin/supplier-staging`
validates source-backed CSV or Excel research, stages valid rows atomically and
supports bulk acceptance, rejection and duplicate decisions. Research remains
separate from supplier applications, outreach contacts and public listings.

Every candidate retains category, public provenance, research date,
pricing-or-quote evidence and image permission state. Acceptance creates only
an unclaimed, unfeatured draft. Pending or rejected images are never copied;
approved imagery additionally requires permission evidence and credit. The
complete operator contract and rollback path are in
`supplier-catalogue-staging-workflow.md`.

No real candidate batch was researched or staged in this slice. The next
evidence step is a read-only primary-source research batch for the most useful
candidate category, followed by review of actual coverage against the release
gate. Nothing should be published or contacted during that step.

## First videographer research sample completed locally - 3 August 2026

The first real source-backed sample is recorded in
`videographer-research-sample.md` with its machine-readable CSV under
`docs/planning-hub/research`. Five official Scottish videography sites provide
usable location, service and explicit package-price evidence. The import parser
accepts all five rows and a regression test keeps the batch valid.

This makes videography the current next research category, not a live category.
Five records are not meaningful national coverage, and none has image
permission evidence. Nothing was imported, published, contacted or staged in a
hosted database. Expand regional coverage and obtain lawful imagery before any
activation review.
