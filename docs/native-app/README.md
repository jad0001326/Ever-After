# EverAft native app plan

Date: 20 August 2026

Status: local planning artifacts only. These documents do not authorise a
commit, push, deployment, Supabase migration, production-data change, feature
flag change, supplier contact, outreach action, paid service or App Store
submission.

## Purpose

This folder defines the first native iPhone and Android client for My EverAft.
It turns the working venue-first Planning Hub into a focused couple-planning
app while preserving the live Next.js website and reusing its tested business
logic.

The native product promise is the same as the web product:

> EverAft turns wedding browsing into an actual wedding plan.

## Documents

1. [Architecture](architecture.md) — repository shape, shared-code boundary,
   authentication, APIs, offline behavior, security and release topology.
2. [MVP product specification](mvp-product-spec.md) — users, outcomes, scope,
   acceptance criteria, measurement and release gates.
3. [Screen map](screen-map.md) — navigation, screen inventory, states, deep
   links and accessibility expectations.
4. [Implementation PR sequence](implementation-pr-sequence.md) — small,
   reviewable slices with dependencies, tests and approval points.
5. [Requirements traceability](requirements-traceability.md) — goal-to-screen,
   PR and evidence mapping that distinguishes planning from implemented proof.
6. [Decision log](decision-log.md) — settled architecture choices, rejected
   alternatives, revisit triggers and choices deliberately deferred to evidence.
7. [Responsive wireframes](responsive-wireframes.md) — compact-phone layouts,
   expanded adaptations, action hierarchy and accessibility reading order for
   the venue-first journey.
8. [Backend change plan](backend-change-plan.md) — live schema baseline,
   code-only/API work, isolated migrations, application order, verification and
   forward-recovery boundaries.
9. [N1 performance baseline](n1-performance-baseline.md) — reproducible local
   before/after mobile Lighthouse, accessibility, rendering and interaction
   evidence for the shared-package extraction.

## Evidence baseline

The plan is based on current `origin/main` at `880a4ee` and the separately
reviewed draft supplier-claim replacement in PR #69.

- The public Planning Hub is a device-storage beta; cloud sync and partner
  sharing remain disabled.
- The original twenty-six declared planning-domain modules established the N0
  boundary. The local N1 extraction now checks twenty-nine runtime modules in
  `planning-domain` and `planning-contracts`, while web compatibility exports
  preserve existing import paths.
- Fifteen Draft 2020-12 JSON Schemas are current for workspace discovery,
  dashboard, budget, profile, tasks and table planning.
- Dormant authenticated API routes already cover workspace discovery,
  dashboard reads, full-plan budget updates, wedding-profile reads/writes,
  task CRUD and complete table-plan reads/writes.
- Production has not applied the older ten-migration dormant tranche, which
  includes five Planning Workspace migrations, and
  `PLANNING_WORKSPACE_CLOUD_ENABLED` remains off.
- The current product has ordinary Supabase sign-out but no user-facing
  personal-data export or account-deletion boundary. Those are public-release
  requirements, not capabilities the native client may assume.
- No native application scaffold currently exists.

## Guiding constraints

- Do not rebuild working planning rules in native components.
- Do not move the live Next.js application into a new directory as a
  prerequisite for the first mobile screen.
- Keep catalogue queries server-side, bounded and paginated.
- Never expose the Supabase secret/service-role key to a native bundle.
- Keep device-only planning usable while connected planning is unavailable.
- Treat partner data, dietary notes, contact details and payment schedules as
  private user data.
- Preserve manual entry wherever EverAft catalogue coverage is insufficient.
- Pair each new backend boundary with the client outcome that requires it;
  avoid an extended backend-only programme.
