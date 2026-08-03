# Planning Hub competitive priority update

Date: 3 August 2026

Source reviewed: the user-provided Scottish Wedding Club launch assessment at
`https://chatgpt.com/share/6a706bba-53b8-83ed-b1c4-940f8e44905d`.

Status: incorporated into the active product goal as directional strategy.
Competitor pricing, catalogue totals and campaign claims still require
primary-source verification before commercial or external action.

## Decision

The review strengthens the Planning Hub direction. It does not justify a new
parallel feature programme. EverAft should win by making real planning state
flow between discovery, decisions, money and organisation, while presenting
that functional difference clearly when the beta is ready to be exposed.

Core competitive proof:

> EverAft turns wedding browsing into an actual wedding plan.

## What is already materially delivered locally

- A connected venue-first journey through discovery, comparison, planning
  state, budget impact, payments and the Photography recommendation.
- Wedding Profile, task lifecycle, guest readiness and table planning in the
  same local workspace.
- A category-neutral supplier platform with truthful manual fallback, bounded
  server search, on-demand details and shared budget/payment behavior.
- Structured venue filters, eight curated venue landing pages and a broad set
  of Scotland-specific planning guides.
- Venue and photographer claiming foundations.
- A mobile performance, interaction and accessibility gate that meets the
  stated lab targets.
- Dormant, caller-RLS-bound native API foundations for workspace discovery,
  dashboard, profile, tasks, budget and table planning.

These are product-depth advantages. They must not be described as live until
the relevant cloud, migration, release and production checks are approved and
complete.

## Gaps the review exposes

1. The public homepage metadata, organisation description, hero and primary
   actions still lead with venue/supplier discovery. They do not prove the
   connected planning proposition.
2. The Planning Hub remains a separate no-index beta and cloud sharing remains
   dormant. The public product therefore cannot yet substantiate a broad
   “plan everything here” claim.
3. Only Photography is catalogue-live inside the Planning Hub. Other supplier
   stages are manual-only by design until real listing and media readiness is
   proven.
4. Claiming exists for venues and photographers, not as a complete public
   category-neutral supplier proposition.
5. Public supplier tiers and pricing are a commercial decision and have not
   been established.
6. Checklist and timeline value exists through tasks, deadlines,
   recommendations and guides, but it is not yet expressed as one obvious
   recurring planning cadence.

## Revised priority order

### 1. Activation readiness and truthful positioning

Finish the evidence and decisions needed to release a useful connected beta.
Do not keep adding dormant API surface unless it removes a concrete native or
release blocker. Prepare public positioning changes alongside release
readiness, but do not link to or advertise protected functionality as live.

### 2. Recurring couple value

Make the dashboard answer: what changed, what is due, what needs a decision and
what should we do next? Prefer improvements that bring couples back weekly over
new disconnected content or category shells.

### 3. Supplier network breadth with quality gates

Prioritise photographers, videographers, florists, celebrants, cakes,
entertainment, bridalwear and hair/makeup when real data exists. Reuse the
shared supplier platform, claiming workflow and budget mappings. Keep every
category manual-only until its activation checklist passes.

### 4. Structured venue and supplier acquisition pages

Prefer specific, data-backed pages and filters over generic editorial volume.
Connect every acquisition page to a useful search, comparison, budget or
Planning Hub action.

### 5. Commercial proposition

Prepare a separate evidence-backed decision for free claiming, enhanced and
featured supplier value, analytics and pricing. No price, payment integration
or billing state is implied by this product goal.

## Near-term release decision gates

- Recheck the live branch, draft PR and current deployment state before any
  release claim.
- Verify Supabase migration history and Auth/Data API behavior only in a free
  local stack or separately approved disposable environment.
- Obtain explicit approval before pushing, deploying, enabling cloud
  persistence, applying migrations or changing production data.
- After release approval, update homepage positioning and navigation in the
  same review sequence so the public promise matches the live product.
- Reassess the competitor after its claimed September 2026 STV campaign using
  read-only primary-source evidence.

## Model execution guidance

Use GPT-5.6 Sol for this goal. Medium reasoning remains the default for bounded
implementation and tests. Raise to High or Ultra for cross-cutting architecture
decisions, security audits, migration/release reviews and difficult debugging.
Luna is reserved for simpler high-volume work; increasing Luna’s reasoning
effort is not a substitute for Sol’s stronger base capability on this project.
