# Supplier catalogue baseline — 9 August 2026

Measured: 9 August 2026 at 14:10–14:15 UTC.

Method: aggregate, read-only queries against the connected production Supabase
project, the repository's GET-only `supplier:audit` command, and anonymous GET
checks of the live Photography collection and one profile. No supplier names,
emails or contact details were exported by the database audit. No insert,
update, delete, RPC mutation, migration, storage request, publication or
outreach occurred.

## Confirmed current production state

| Measure | Confirmed value |
| --- | ---: |
| Supplier categories | 16 |
| Database-live categories | 1 |
| Listings | 31 |
| Published | 31 |
| Draft | 0 |
| Archived | 0 |
| Claims | 0 |
| Listings linked to a vendor | 0 |
| Listings with an active owner | 0 |
| Approved gallery images | 0 |
| Profiles meeting the strict activation gate | 0 |

All 31 listings are published Photographers. The other fifteen configured
categories have no production listings in any state. Photography remains the
only database-live and application-live supplier category.

## Photography evidence

All 31 profiles have a Scottish town and region, summary, description,
services, official website, source URL and recorded review. All 31 have a
matching `photographer_profiles` record; 27 contain at least one style tag.
The public collection reports 31 matches and both it and a sampled profile
returned HTTP 200.

The material gaps are:

- 0 profiles have confirmed starting, typical or described quote pricing;
- 0 profiles have a hero image URL;
- `supplier_images` has no rows, so there is no approved gallery;
- all rows carry the `representative` image state, but without an image URL it
  provides no usable or approved visual;
- 0 profiles are claimed, linked to a vendor or connected to an active owner;
- structured coverage-hour and turnaround ranges are empty.

`published` therefore proves public visibility, not that Photography meets the
updated supplier activation gate.

## Current, staged and projected state

The hosted database contains no supplier applications, supplier claims,
supplier outreach contacts or supplier enrichment records. Existing
enrichment data is venue-only. Production also does not yet contain the local
catalogue-staging, supplier-owner-update or supplier-image-submission tables.

Fourteen source-backed Videography candidates remain local research evidence:
they are not production rows, staged records, drafts or projected live
profiles. Ten have recorded numeric price evidence and four are explicitly
quote-only. All fourteen remain image-free. Two retain separate manual review
blockers. Their sources and volatile facts must be refreshed before any later
staging or acceptance.

## Activation decision

Do not activate a second category. It would expose an empty catalogue, and the
local Videography research still lacks image rights, current acceptance review
and meaningful confirmed production coverage.

The smallest reusable code slice is instead the category-safe supplier to
Budget Planner handoff. It must:

1. preserve the couple's selected venue when a supplier is added;
2. map every supplier through its configured Budget Planner category;
3. exclude inactive categories defensively from the public planner;
4. prevent the admin form from publishing an inactive category;
5. keep supplier profile media bounded.

This slice changes no category flag, catalogue data, migration, outreach state,
deployment or billing.
