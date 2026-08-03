# Supplier catalogue baseline

Measured: 3 August 2026 at 11:43 UTC; refreshed at 16:29 UTC with no count or
readiness change.

Method: the local `supplier:audit` command performed paginated GET requests
against the configured Supabase Data API with protected server credentials. It
read only aggregate inputs from supplier categories, listings, images and
claims. It made no insert, update, delete, RPC, migration or storage request.

## Current confirmed state

| Measure | Confirmed current value |
| --- | ---: |
| Configured supplier categories | 16 |
| Database-live categories | 1 |
| Supplier listings | 31 |
| Published | 31 |
| Draft | 0 |
| Archived | 0 |
| Claimed | 0 |
| Open claims | 0 |
| Approved gallery images | 0 |
| Complete published profiles under the activation gate | 0 |

All 31 listings are Photographers. Every other configured category currently
has zero listings.

## Photography readiness

| Readiness field | Listings passing | Total |
| --- | ---: | ---: |
| Town and region | 31 | 31 |
| Summary | 31 | 31 |
| Description | 31 | 31 |
| Services | 31 | 31 |
| Source URL or official website | 31 | 31 |
| Confirmed price or explicit described quote handling | 0 | 31 |
| Approved or representative visual | 0 | 31 |
| Complete published profile | 0 | 31 |
| Potential normalized name/town duplicate groups | 0 | 31 |

`published` describes current database visibility; it does not prove that a
listing passes the stricter product activation gate. The missing pricing and
visual evidence means the Photography catalogue needs a quality pass even
though it is already published.

## Decision

Do not activate a second category yet. There is no current listing coverage to
support one, and an arbitrary category flag would only expose an empty
catalogue.

Proceed on two separate tracks:

1. Build the reusable category-neutral public profile, claim and bounded owner
   self-service foundation locally.
2. Prepare a source-backed, reviewable acquisition batch for one next category
   without publishing it. Category choice should follow evidence gathered in
   that staged batch, not the earlier candidate list alone.

Photography also needs an evidence-backed enrichment pass for pricing/quote
handling and permitted imagery. Research, enrichment, publication and outreach
remain distinct states.

## Repeatable command

`npm run supplier:audit`

The command fails closed unless `--read-only` is present internally, has no
write mode and requires protected server credentials for complete draft,
claim and readiness evidence. It emits aggregate JSON only; it does not print
credentials or supplier contact data.

## Approval boundary

This baseline authorises no supplier publication, outreach, migration,
deployment, billing or paid infrastructure. Any later production mutation
still requires explicit approval.
