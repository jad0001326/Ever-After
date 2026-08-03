import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const ids = {
  owner: "10000000-0000-4000-8000-000000000001",
  outsider: "20000000-0000-4000-8000-000000000002",
  admin: "30000000-0000-4000-8000-000000000003",
  vendor: "40000000-0000-4000-8000-000000000004",
  supplier: "50000000-0000-4000-8000-000000000005",
  removedRequest: "60000000-0000-4000-8000-000000000006",
  supplierImage: "70000000-0000-4000-8000-000000000007",
  imageSubmission: "71000000-0000-4000-8000-000000000007"
};

function assert(condition, message) {
  if (!condition) throw new Error(`Supplier owner security contract failed: ${message}`);
}

async function asUser(db, userId, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try { return await db.query(sql); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}

async function expectDenied(action, message) {
  try { await action(); } catch { return; }
  throw new Error(`Supplier owner security contract failed: ${message}`);
}

const db = await PGlite.create({ extensions: { pgcrypto } });
try {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create schema private authorization postgres; create schema storage authorization postgres;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(regexp_replace(name, '/[^/]+$', ''), '/') $$;
    create function storage.extension(name text) returns text language sql immutable as $$ select nullif(regexp_replace(name, '^.*\\.', ''), name) $$;
    create table public.profiles (id uuid primary key, email text, full_name text, role text not null default 'couple');
    create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null references storage.buckets(id), name text not null, owner_id text, unique (bucket_id, name));
    create table public.vendors (id uuid primary key, name text not null, status text not null default 'active');
    create table public.vendor_users (vendor_id uuid references public.vendors, user_id uuid references public.profiles, role text default 'owner', status text default 'active', created_at timestamptz default now(), primary key (vendor_id, user_id));
    create table public.supplier_categories (slug text primary key, name text not null, plural_name text not null, description text not null default '', budget_category_id text, sort_order integer default 100, is_live boolean default false, created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.supplier_listings (
      id uuid primary key default gen_random_uuid(), vendor_id uuid references public.vendors, category_slug text not null, slug text not null, name text not null,
      base_town text not null, region text not null check (char_length(region) <= 120), country text not null default 'Scotland', service_areas text[] not null default '{}', travel_radius_miles integer,
      travels_nationwide boolean not null default false, summary text not null, description text not null, services text[] not null default '{}',
      official_website_url text, instagram_url text, facebook_url text, enquiry_url text, source_url text,
      starting_price_pence integer, typical_price_pence integer, pricing_summary text, pricing_unit text not null default 'quote',
      hero_image_url text, image_credit text, image_permission_status text not null default 'representative', listing_status text not null default 'draft',
      claim_status text not null default 'unclaimed', is_claimed boolean not null default false, is_featured boolean not null default false,
      published_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references public.profiles, created_at timestamptz default now(), updated_at timestamptz default now()
    );
    create table public.photographer_profiles (supplier_id uuid primary key references public.supplier_listings(id), styles text[] default '{}', coverage_hours_min numeric, coverage_hours_max numeric, second_photographer_available boolean, engagement_shoot_available boolean, drone_available boolean, film_photography_available boolean, albums_available boolean, turnaround_weeks_min integer, turnaround_weeks_max integer, updated_at timestamptz default now());
    create table public.supplier_images (id uuid primary key default gen_random_uuid(), supplier_id uuid not null references public.supplier_listings(id), url text not null, alt text not null, credit_text text, permission_status text not null default 'pending', sort_order integer not null default 0, created_at timestamptz default now());
    create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
    create function private.is_admin() returns boolean language sql stable security definer set search_path = pg_catalog as $$
      select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    $$;
    grant usage on schema public, auth, private, storage to anon, authenticated, service_role;
    grant execute on function auth.uid(), private.is_admin(), storage.foldername(text), storage.extension(text) to anon, authenticated, service_role;
    grant select, insert, update, delete on public.vendor_users, public.supplier_listings, public.photographer_profiles, public.supplier_images, storage.objects to authenticated;
    alter table public.vendor_users enable row level security; alter table public.supplier_listings enable row level security; alter table public.supplier_images enable row level security; alter table storage.objects enable row level security;
    create policy "Published supplier listings are public" on public.supplier_listings for select using (listing_status = 'published' or private.is_admin());
    create policy "Admins update supplier listings" on public.supplier_listings for update to authenticated using (private.is_admin()) with check (private.is_admin());
    create policy "Admins insert supplier listings" on public.supplier_listings for insert to authenticated with check (private.is_admin());
    create policy "Admins manage supplier images" on public.supplier_images for all to authenticated using (private.is_admin()) with check (private.is_admin());
    create policy "Admins manage vendor users" on public.vendor_users for all to authenticated using (private.is_admin()) with check (private.is_admin());
    create policy "Vendor users read own links" on public.vendor_users for select to authenticated using (user_id = auth.uid());
    insert into public.profiles values ('${ids.owner}', 'owner@example.com', 'Owner', 'couple'), ('${ids.outsider}', 'outsider@example.com', 'Outsider', 'couple'), ('${ids.admin}', 'admin@example.com', 'Admin', 'admin');
    insert into public.vendors values ('${ids.vendor}', 'Test supplier', 'active');
    insert into public.supplier_categories (slug, name, plural_name, is_live) values ('photographer', 'Photographer', 'Photographers', true), ('videographer', 'Videographer', 'Videographers', false);
    insert into public.vendor_users (vendor_id, user_id) values ('${ids.vendor}', '${ids.owner}');
    insert into public.supplier_listings (id, vendor_id, category_slug, slug, name, base_town, region, summary, description, services, claim_status, is_claimed)
      values ('${ids.supplier}', '${ids.vendor}', 'photographer', 'test-supplier', 'Test Supplier', 'Edinburgh', 'Lothians', 'A useful supplier summary for testing.', 'A sufficiently detailed supplier description used for the database security verification.', array['Photography'], 'approved', true);
  `);
  const migration = await readFile(new URL("../supabase/migrations/20260803122711_supplier_owner_update_requests.sql", import.meta.url), "utf8");
  await db.exec(migration);
  const stagingMigration = await readFile(new URL("../supabase/migrations/20260803130045_supplier_catalogue_staging.sql", import.meta.url), "utf8");
  await db.exec(stagingMigration);
  const imageMigration = await readFile(new URL("../supabase/migrations/20260803165651_supplier_image_submissions.sql", import.meta.url), "utf8");
  await db.exec(imageMigration);

  const ownerListing = await asUser(db, ids.owner, `select id from public.supplier_listings where id = '${ids.supplier}'`);
  assert(ownerListing.rows.length === 1, "active owner cannot read their managed draft listing");
  const outsiderListing = await asUser(db, ids.outsider, `select id from public.supplier_listings where id = '${ids.supplier}'`);
  assert(outsiderListing.rows.length === 0, "outsider can read a managed draft listing");

  const privatePath = `${ids.owner}/${ids.supplier}/${ids.supplierImage}.jpg`;
  await expectDenied(
    () => asUser(db, ids.outsider, `insert into storage.objects (bucket_id, name, owner_id) values ('supplier-image-submissions', '${ids.outsider}/${ids.supplier}/${ids.supplierImage}.jpg', '${ids.outsider}')`),
    "outsider can upload a private supplier image",
  );
  await asUser(db, ids.owner, `insert into storage.objects (bucket_id, name, owner_id) values ('supplier-image-submissions', '${privatePath}', '${ids.owner}')`);
  await expectDenied(
    () => asUser(db, ids.owner, `insert into public.supplier_image_submissions
      (supplier_id, submitted_by, storage_path, original_file_name, mime_type, file_size, alt_text, permission_confirmed)
      values ('${ids.supplier}', '${ids.owner}', '${privatePath}', 'test.jpg', 'image/jpeg', 1200, 'Supplier at work', false)`),
    "supplier member can register an image without confirming display rights",
  );
  await asUser(db, ids.owner, `insert into public.supplier_image_submissions
    (id, supplier_id, submitted_by, storage_path, original_file_name, mime_type, file_size, alt_text, credit_text, is_preferred, permission_confirmed, permission_confirmed_at)
    values ('${ids.imageSubmission}', '${ids.supplier}', '${ids.owner}', '${privatePath}', 'test.jpg', 'image/jpeg', 1200, 'Supplier at work', 'Supplier team', true, true, now())`);
  const ownerImage = await asUser(db, ids.owner, `select id from public.supplier_image_submissions where id = '${ids.imageSubmission}'`);
  assert(ownerImage.rows.length === 1, "active supplier member cannot read their image submission");
  const outsiderImage = await asUser(db, ids.outsider, `select id from public.supplier_image_submissions where id = '${ids.imageSubmission}'`);
  assert(outsiderImage.rows.length === 0, "outsider can read a supplier image submission");
  await asUser(db, ids.owner, `update public.supplier_image_submissions set admin_notes = 'self approved' where id = '${ids.imageSubmission}'`);
  const ownerUnchangedImage = await db.query(`select admin_notes, status from public.supplier_image_submissions where id = '${ids.imageSubmission}'`);
  assert(ownerUnchangedImage.rows[0]?.admin_notes == null && ownerUnchangedImage.rows[0]?.status === "pending", "supplier member can review their own image");
  await expectDenied(
    () => asUser(db, ids.owner, `insert into public.supplier_images (supplier_id, url, alt, permission_status) values ('${ids.supplier}', 'https://example.com/unreviewed.jpg', 'Unreviewed', 'approved')`),
    "supplier member can directly publish an image",
  );
  await expectDenied(
    () => asUser(db, ids.owner, `insert into storage.objects (bucket_id, name, owner_id) values ('supplier-images', '${ids.supplier}/owner-published.jpg', '${ids.owner}')`),
    "supplier member can directly upload to the public image bucket",
  );
  await asUser(db, ids.owner, `delete from storage.objects where bucket_id = 'supplier-image-submissions' and name = '${privatePath}'`);
  const pendingPrivateObject = await db.query(`select id from storage.objects where bucket_id = 'supplier-image-submissions' and name = '${privatePath}'`);
  assert(pendingPrivateObject.rows.length === 1, "supplier member can orphan a pending review row by deleting its private object directly");
  await asUser(db, ids.admin, `insert into storage.objects (bucket_id, name, owner_id) values ('supplier-images', '${ids.supplier}/admin-reviewed.jpg', '${ids.admin}')`);
  await asUser(db, ids.admin, `delete from storage.objects where bucket_id = 'supplier-images' and name = '${ids.supplier}/admin-reviewed.jpg'`);
  await asUser(db, ids.admin, `update public.supplier_image_submissions set status = 'rejected', admin_notes = 'Replace this image', reviewed_at = now(), reviewed_by = '${ids.admin}' where id = '${ids.imageSubmission}'`);
  const rejectedImage = await db.query(`select status, admin_notes from public.supplier_image_submissions where id = '${ids.imageSubmission}'`);
  assert(rejectedImage.rows[0]?.status === "rejected" && rejectedImage.rows[0]?.admin_notes === "Replace this image", "admin could not review a supplier image");
  await asUser(db, ids.owner, `delete from public.supplier_image_submissions where id = '${ids.imageSubmission}'`);
  await asUser(db, ids.owner, `delete from storage.objects where bucket_id = 'supplier-image-submissions' and name = '${privatePath}'`);
  const removedPrivateObject = await db.query(`select id from storage.objects where bucket_id = 'supplier-image-submissions' and name = '${privatePath}'`);
  assert(removedPrivateObject.rows.length === 0, "supplier member could not remove their rejected private image");

  const imageBuckets = await db.query(`select id, public, file_size_limit, allowed_mime_types from storage.buckets where id in ('supplier-image-submissions', 'supplier-images') order by id`);
  assert(imageBuckets.rows.length === 2, "supplier image buckets were not created");
  assert(imageBuckets.rows.find((row) => row.id === "supplier-image-submissions")?.public === false, "private supplier submission bucket is public");
  assert(imageBuckets.rows.find((row) => row.id === "supplier-images")?.public === true, "approved supplier image bucket is not public");

  const insertSql = (requestId, userId) => `insert into public.supplier_update_requests
    (id, supplier_id, submitted_by, proposed_base_town, proposed_region, proposed_service_areas, proposed_summary, proposed_description, proposed_services, proposed_pricing_unit, requested_message)
    values ('${requestId}', '${ids.supplier}', '${userId}', 'Glasgow', 'Greater Glasgow', array['Central Scotland'], 'An updated useful supplier summary.', 'An updated and sufficiently detailed supplier description for couples.', array['Photography', 'Albums'], 'package', 'Please review our refreshed profile details.')`;
  await expectDenied(() => asUser(db, ids.owner, `insert into public.supplier_update_requests
    (id, supplier_id, submitted_by, proposed_base_town, proposed_region, proposed_summary, proposed_description, proposed_services, proposed_official_website_url, requested_message)
    values ('a0000000-0000-4000-8000-00000000000a', '${ids.supplier}', '${ids.owner}', 'Glasgow', 'Greater Glasgow', 'An updated useful supplier summary.', 'An updated and sufficiently detailed supplier description for couples.', array['Photography'], 'javascript:alert(1)', 'Please review our refreshed profile details.')`), "owner can stage an unsafe public URL");
  await asUser(db, ids.owner, insertSql(ids.removedRequest, ids.owner));
  const ownerRequest = await asUser(db, ids.owner, `select id from public.supplier_update_requests where id = '${ids.removedRequest}'`);
  assert(ownerRequest.rows.length === 1, "active supplier member cannot read the pending proposal");
  const outsiderRequest = await asUser(db, ids.outsider, `select id from public.supplier_update_requests where id = '${ids.removedRequest}'`);
  assert(outsiderRequest.rows.length === 0, "outsider can read a supplier proposal");
  await expectDenied(() => asUser(db, ids.owner, insertSql("90000000-0000-4000-8000-000000000009", ids.owner)), "owner can create two pending proposals for one supplier");
  await expectDenied(() => asUser(db, ids.outsider, insertSql("70000000-0000-4000-8000-000000000007", ids.outsider)), "outsider can submit an owner proposal");
  await asUser(db, ids.owner, `update public.supplier_update_requests set status = 'approved' where id = '${ids.removedRequest}'`);
  const stillPending = await db.query(`select status from public.supplier_update_requests where id = '${ids.removedRequest}'`);
  assert(stillPending.rows[0]?.status === "pending", "owner can approve their own proposal");
  await asUser(db, ids.owner, `update public.supplier_listings set listing_status = 'published' where id = '${ids.supplier}'`);
  const stillDraft = await db.query(`select listing_status from public.supplier_listings where id = '${ids.supplier}'`);
  assert(stillDraft.rows[0]?.listing_status === "draft", "owner can directly publish their listing");

  await asUser(db, ids.admin, `select * from public.review_supplier_update_request('${ids.removedRequest}', 'approved', 'Checked')`);
  const applied = await db.query(`select base_town, listing_status, is_featured, vendor_id, claim_status from public.supplier_listings where id = '${ids.supplier}'`);
  assert(applied.rows[0]?.base_town === "Glasgow", "approved bounded field was not applied");
  assert(applied.rows[0]?.listing_status === "draft" && applied.rows[0]?.is_featured === false, "review altered publication controls");
  assert(applied.rows[0]?.vendor_id === ids.vendor && applied.rows[0]?.claim_status === "approved", "review altered ownership controls");
  await expectDenied(() => asUser(db, ids.admin, `select * from public.review_supplier_update_request('${ids.removedRequest}', 'approved', null)`), "request can be reviewed twice");

  const secondId = "80000000-0000-4000-8000-000000000008";
  await asUser(db, ids.owner, insertSql(secondId, ids.owner));
  await db.exec(`update public.vendor_users set status = 'paused' where vendor_id = '${ids.vendor}' and user_id = '${ids.owner}'`);
  await expectDenied(() => asUser(db, ids.admin, `select * from public.review_supplier_update_request('${secondId}', 'approved', null)`), "admin can apply an update after membership removal");

  const contract = await db.query(`select p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'execute') as anon_execute from pg_proc p where p.proname = 'review_supplier_update_request'`);
  assert(contract.rows[0]?.prosecdef === false, "review RPC is security definer");
  assert(contract.rows[0]?.proconfig?.includes("search_path=\"\"") === true, "review RPC has a mutable search path");
  assert(contract.rows[0]?.anon_execute === false, "anonymous users can execute the review RPC");

  const candidate = JSON.stringify([{
    row_number: 2, identity_key: "videographer:staged-films", category_slug: "videographer", slug: "staged-films", business_name: "Staged Films",
    base_town: "Glasgow", region: "Greater Glasgow", country: "Scotland", service_areas: ["Glasgow"], travels_nationwide: true,
    summary: "Story-led wedding films across Scotland.", description: "A documentary wedding film team covering celebrations throughout Scotland.", services: ["Wedding films"],
    official_website_url: "https://films.example/", instagram_url: null, facebook_url: null, enquiry_url: null,
    starting_price_pence: null, typical_price_pence: null, pricing_summary: "Contact the supplier for a tailored quote.", pricing_unit: "quote",
    hero_image_url: "https://films.example/photo.jpg", image_credit: null, image_permission_status: "pending", image_permission_evidence_url: null,
    source_url: "https://films.example/about", source_type: "official_website", researched_at: "2026-08-03", review_notes: null
  }]).replaceAll("'", "''");
  await expectDenied(() => asUser(db, ids.owner, `insert into public.supplier_catalogue_batches (file_name, source_label, research_date, created_by) values ('owner.csv', 'Owner batch', '2026-08-03', '${ids.owner}')`), "supplier owner can directly create a catalogue batch");
  await expectDenied(() => asUser(db, ids.owner, `select * from public.stage_supplier_catalogue_batch('batch.csv', 'Test batch', '2026-08-03', '${candidate}'::jsonb)`), "supplier owner can stage catalogue research");
  const stagedBatch = await asUser(db, ids.admin, `select * from public.stage_supplier_catalogue_batch('batch.csv', 'Test batch', '2026-08-03', '${candidate}'::jsonb)`);
  assert(stagedBatch.rows[0]?.candidate_count === 1, "admin batch staging did not insert exactly one candidate");
  assert(stagedBatch.rows[0]?.duplicate_count === 0, "new supplier was incorrectly flagged as a duplicate");
  const stagedCandidate = await asUser(db, ids.admin, "select id from public.supplier_catalogue_candidates where identity_key = 'videographer:staged-films'");
  const stagedCandidateId = stagedCandidate.rows[0]?.id;
  assert(Boolean(stagedCandidateId), "staged candidate was not visible to admin");
  const ownerCandidate = await asUser(db, ids.owner, "select id from public.supplier_catalogue_candidates");
  assert(ownerCandidate.rows.length === 0, "supplier owner can read admin catalogue staging");
  await asUser(db, ids.admin, `select * from public.review_supplier_catalogue_candidates(array['${stagedCandidateId}']::uuid[], 'accepted', 'Source checked')`);
  const promoted = await db.query("select listing_status, is_featured, is_claimed, hero_image_url, image_permission_status from public.supplier_listings where slug = 'staged-films'");
  assert(promoted.rows[0]?.listing_status === "draft" && promoted.rows[0]?.is_featured === false && promoted.rows[0]?.is_claimed === false, "accepted research bypassed draft-only controls");
  assert(promoted.rows[0]?.hero_image_url == null && promoted.rows[0]?.image_permission_status === "representative", "unapproved candidate image reached the listing");
  const reviewedBatch = await db.query(`select status from public.supplier_catalogue_batches where id = '${stagedBatch.rows[0]?.batch_id}'`);
  assert(reviewedBatch.rows[0]?.status === "reviewed", "fully reviewed batch stayed open");

  const reviewCandidate = candidate
    .replaceAll("staged-films", "review-films")
    .replaceAll("Staged Films", "Review Films")
    .replaceAll("films.example", "review.example")
    .replace('"review_notes":null', '"review_notes":"Official sources conflict; confirm the current package before acceptance."');
  const reviewBatch = await asUser(db, ids.admin, `select * from public.stage_supplier_catalogue_batch('review.csv', 'Manual review check', '2026-08-03', '${reviewCandidate}'::jsonb)`);
  const reviewCandidateRow = await asUser(db, ids.admin, `select id from public.supplier_catalogue_candidates where batch_id = '${reviewBatch.rows[0]?.batch_id}'`);
  const reviewCandidateId = reviewCandidateRow.rows[0]?.id;
  await expectDenied(
    () => asUser(db, ids.admin, `select * from public.review_supplier_catalogue_candidates(array['${reviewCandidateId}']::uuid[], 'accepted', null)`),
    "candidate with unresolved research notes can be accepted without a recorded resolution",
  );
  await asUser(db, ids.admin, `select * from public.review_supplier_catalogue_candidates(array['${reviewCandidateId}']::uuid[], 'accepted', 'Compared both current official pages and retained quote-only pricing')`);
  const resolvedCandidate = await db.query(`select review_notes from public.supplier_catalogue_candidates where id = '${reviewCandidateId}'`);
  assert(resolvedCandidate.rows[0]?.review_notes?.includes("Official sources conflict") && resolvedCandidate.rows[0]?.review_notes?.includes("Resolution:"), "manual review evidence or its resolution was not retained");

  const duplicateBatch = await asUser(db, ids.admin, `select * from public.stage_supplier_catalogue_batch('duplicate.csv', 'Duplicate check', '2026-08-03', '${candidate}'::jsonb)`);
  assert(duplicateBatch.rows[0]?.duplicate_count === 1, "duplicate batch count did not flag the existing supplier");
  const duplicateCandidate = await asUser(db, ids.admin, `select id, review_notes from public.supplier_catalogue_candidates where batch_id = '${duplicateBatch.rows[0]?.batch_id}'`);
  const duplicateCandidateId = duplicateCandidate.rows[0]?.id;
  assert(duplicateCandidate.rows[0]?.review_notes?.startsWith("Possible duplicate"), "staging did not flag an existing supplier identity");
  await expectDenied(() => asUser(db, ids.admin, `select * from public.review_supplier_catalogue_candidates(array['${duplicateCandidateId}']::uuid[], 'accepted', null)`), "duplicate candidate can be accepted over an existing listing");
  await asUser(db, ids.admin, `select * from public.review_supplier_catalogue_candidates(array['${duplicateCandidateId}']::uuid[], 'duplicate', 'Existing slug and source checked')`);
  const duplicateStatus = await db.query(`select review_status from public.supplier_catalogue_candidates where id = '${duplicateCandidateId}'`);
  assert(duplicateStatus.rows[0]?.review_status === "duplicate", "explicit duplicate decision was not retained");

  const stagingContracts = await db.query(`select p.proname, p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'execute') as anon_execute from pg_proc p where p.proname in ('stage_supplier_catalogue_batch', 'review_supplier_catalogue_candidates') order by p.proname`);
  assert(stagingContracts.rows.length === 2, "expected two supplier staging RPCs");
  for (const row of stagingContracts.rows) {
    assert(row.prosecdef === false, `${row.proname} is security definer`);
    assert(row.proconfig?.includes("search_path=\"\"") === true, `${row.proname} has a mutable search path`);
    assert(row.anon_execute === false, `anonymous users can execute ${row.proname}`);
  }
  const anonymousStagingPrivileges = await db.query(`select has_table_privilege('anon', 'public.supplier_catalogue_batches', 'select') as batch_select, has_table_privilege('anon', 'public.supplier_catalogue_candidates', 'select') as candidate_select`);
  assert(anonymousStagingPrivileges.rows[0]?.batch_select === false && anonymousStagingPrivileges.rows[0]?.candidate_select === false, "anonymous role retains staging table access");
  console.log("Supplier owner, imagery and staging RLS verification passed: member isolation, private rights-confirmed uploads, admin-only image review, bounded owner updates, atomic catalogue batches, mandatory conflict resolution, draft-only promotion and RPC hardening.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.close();
}
