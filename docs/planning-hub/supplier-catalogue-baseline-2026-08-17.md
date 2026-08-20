# Supplier catalogue baseline — 17 August 2026

Measured: 17 August 2026 at 10:11 UTC.

Method: aggregate, read-only queries against the connected production Supabase
project plus a comparison with current `origin/main` and the three committed
Videography research batches. No supplier names, emails or private contact
details were exported from production. No insert, update, delete, migration,
storage request, publication, outreach or billing action occurred.

## Confirmed current production state

| Measure | Confirmed value |
| --- | ---: |
| Supplier categories | 16 |
| Database-live categories | 1 |
| Supplier listings | 31 |
| Published listings | 31 |
| Draft or archived listings | 0 |
| Supplier claims | 0 |
| Listings linked to a vendor | 0 |
| Approved hero images | 0 |
| Approved supplier gallery images | 0 |
| Supplier-to-venue connections | 0 |

All 31 production listings are published Photographers. The other fifteen
configured categories have no production listings in any state. Photography
is the only database-live and application-live supplier category.

## Photography quality evidence

| Published-profile field | Confirmed coverage |
| --- | ---: |
| Scottish town and region | 31 / 31 |
| Summary of at least 60 characters | 31 / 31 |
| Description of at least 150 characters | 13 / 31 |
| Official website | 31 / 31 |
| Recorded source URL | 31 / 31 |
| At least one service | 31 / 31 |
| At least one style tag | 27 / 31 |
| Numeric or described pricing | 0 / 31 |
| Approved hero image | 0 / 31 |
| Instagram URL | 0 / 31 |
| Direct enquiry URL | 0 / 31 |
| Structured coverage hours | 0 / 31 |
| Structured turnaround range | 0 / 31 |

All 31 listings retain `representative` image status and have no hero URL or
image credit. `supplier_images` contains no rows. Twenty-three listings state
nationwide travel, but none records a structured travel radius. Only one or
two profiles record each of the optional second-photographer, engagement,
drone, film or album fields.

`published` therefore confirms public visibility, not completion of the
stricter activation gate. Photography is useful as the reference catalogue,
but imagery, pricing, richer profiles and owner participation remain measurable
quality gaps.

## Current, local-research and future state

Production contains no supplier applications, claims, outreach contacts,
supplier images, supplier-to-venue connections or supplier favourites.
The catalogue-staging, owner-update and image-submission tables are not present,
and no supplier-claim review routine is deployed.

Fourteen Videography candidates remain committed local research only. Ten have
current numeric price evidence and four are explicitly quote-only. One source
conflict still requires operator resolution, and all fourteen remain without
image permission. They are not production rows, staged records, drafts or
projected live profiles.

The migration-backed supplier administration and claim work remains a separate
release decision. This audit does not clear PR #61, its migration tranche or
any production feature flag for activation.

## Readiness decision

Do not activate a second supplier category. Videography has promising lawful
research breadth, but no accepted production records, approved imagery,
operator-reviewed staging state or verified mobile catalogue using real data.

The next supplier sequence is:

1. Keep all non-Photography categories on the existing connected manual-entry
   experience.
2. Resolve and re-review the supplier administration and claim release before
   any migration or flag approval.
3. In an approved non-production environment, import the fourteen Videography
   candidates into staging only and resolve the remaining source conflict.
4. Establish explicit image permission and operator acceptance before any row
   can become a published listing.
5. Require useful regional depth, real-data search/profile QA, mobile
   accessibility and performance evidence before changing `live` to `true`.

This keeps confirmed live coverage, local research and future activation
strictly separate while preserving the no-cost and no-publication boundary.
