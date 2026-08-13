# Supplier catalogue staging workflow

Date: 3 August 2026

Status: implemented and verified locally. The migration is not applied to any
hosted database, and no supplier research, publication or outreach occurred as
part of this slice.

## Purpose

This workflow separates public-source supplier research from owner-submitted
applications and from the live directory. It gives EverAft a batch path for
building category coverage without treating research as consent, publication,
image permission or outreach eligibility.

The admin route is `/admin/supplier-staging`. It accepts CSV or Excel files,
validates up to 500 rows, retains valid rows in one atomic batch and supports a
single decision across up to 100 selected candidates. Acceptance creates
`supplier_listings` records in `draft` state only.

## Required evidence

Every valid candidate contains:

- a configured category slug, business identity and Scottish location;
- useful summary, description, services and service coverage;
- at least one official public website, social or enquiry presence, plus a
  public source URL and source type;
- a research date that is not in the future;
- confirmed price guidance or an explicit quote-required explanation;
- an explicit image state, with evidence URL and credit required before an
  image can be marked approved.
- any unresolved identity, price or provenance conflict in `Review notes`.
  A noted candidate cannot be accepted until the operator records a resolution.

The reusable template is
`public/templates/supplier-catalogue-import-template.csv`. Services and service
areas are separated with `|`. The importer accepts a `Supplier Catalogue`
worksheet or the first worksheet in an `.xlsx` file.

## States and boundaries

`supplier_catalogue_batches` records the file, source label, default research
date, admin creator and open/reviewed state. `supplier_catalogue_candidates`
records each source-backed row and its staged, accepted, rejected or duplicate
decision.

- Staged is internal research, not a listing.
- Accepted creates an unfeatured, unclaimed draft; it never publishes.
- Rejected retains the evidence and requires a review note.
- Duplicate retains the evidence and requires a review note.
- Pending or rejected candidate imagery is never copied to a listing.
- Approved imagery is copied only when both permission evidence and credit are
  present.
- Contact emails, legal basis and outreach state do not belong in this import.
  They remain in the separate protected outreach workflow.

Potential duplicates are flagged against existing listing slugs and active
staged identities. The database rechecks the unique listing slug during
acceptance so a race cannot silently create a second profile.

Source research notes survive staging. Acceptance of any candidate carrying a
note requires a non-empty operator resolution, and both the original note and
resolution remain in the audit record.

## Security and rollback

Both staging tables have RLS and explicit grants. Only authenticated admins can
read or mutate them. Atomic staging and review functions are security invoker,
use an empty search path, recheck admin access and are not executable by
anonymous users.

Before a hosted migration, compare remote migration history and take a schema
backup. If no batches exist, rollback can revoke and remove the two functions,
policies and tables in dependency order. Once research exists, retain its audit
trail: revoke staging/review execution and table grants, remove the application
route, and use a forward corrective migration rather than dropping evidence.

## Verification

The embedded PostgreSQL scenario proves:

- non-admin users cannot stage or read catalogue research;
- an admin stages a complete batch atomically;
- acceptance creates only an unclaimed, unfeatured draft;
- unapproved imagery is excluded from that draft;
- a matching existing supplier is flagged and cannot be accepted;
- explicit duplicate review is retained;
- unresolved source or price conflicts cannot be bulk-accepted without a
  recorded resolution;
- completed batches leave the open queue;
- both RPCs remain security invoker with anonymous execution revoked.

No category becomes live from this workflow. A category still needs meaningful
accepted coverage, approved imagery, mobile/profile/search verification and
explicit production approval before activation.
