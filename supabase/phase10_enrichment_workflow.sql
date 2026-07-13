-- Phase 10: reviewable, idempotent business enrichment workflow.
-- Run after the base schema. Dry-run research can remain filesystem-only; these
-- private tables hold staged evidence and approved changes after review.

create table if not exists public.enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'dry_run' check (mode in ('dry_run', 'review', 'apply', 'rollback')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  source_fingerprint text not null unique check (char_length(source_fingerprint) between 1 and 128),
  scope jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  external_usage jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrichment_records (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.enrichment_runs(id) on delete cascade,
  entity_type text not null check (entity_type in ('venue', 'vendor', 'supplier_application')),
  entity_id uuid not null,
  entity_snapshot jsonb not null default '{}'::jsonb,
  eligibility_blockers text[] not null default '{}'::text[],
  quality_blockers text[] not null default '{}'::text[],
  missing_fields text[] not null default '{}'::text[],
  business_status text not null default 'uncertain' check (business_status in ('active', 'likely_active', 'temporarily_closed', 'closed', 'rebranded', 'duplicate', 'uncertain')),
  research_status text not null default 'pending' check (research_status in ('pending', 'processing', 'researched', 'verified', 'manual_review', 'failed', 'skipped')),
  requires_manual_review boolean not null default false,
  before_outreach_eligible boolean not null default false,
  after_outreach_eligible boolean,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz default now(),
  locked_by text,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, entity_type, entity_id),
  check ((locked_by is null) = (locked_at is null))
);

create table if not exists public.business_enrichment_profiles (
  entity_type text not null check (entity_type in ('venue', 'vendor', 'supplier_application')),
  entity_id uuid not null,
  trading_name text,
  contact_page_url text,
  enquiry_page_url text,
  public_email text,
  enquiries_email text,
  wedding_email text,
  sales_email text,
  phone text,
  full_address text,
  address_line_1 text,
  address_line_2 text,
  town text,
  county_region text,
  country text,
  postcode text,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  linkedin_url text,
  services jsonb not null default '[]'::jsonb,
  areas_served jsonb not null default '[]'::jsonb,
  structured_pricing jsonb not null default '{}'::jsonb,
  business_status text not null default 'uncertain' check (business_status in ('active', 'likely_active', 'temporarily_closed', 'closed', 'rebranded', 'duplicate', 'uncertain')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

create table if not exists public.enrichment_field_proposals (
  id uuid primary key default gen_random_uuid(),
  enrichment_record_id uuid not null references public.enrichment_records(id) on delete cascade,
  target_table text not null check (target_table in ('venues', 'business_enrichment_profiles')),
  target_field text not null check (char_length(target_field) between 1 and 80),
  previous_value jsonb,
  proposed_value jsonb not null,
  source_url text not null check (char_length(source_url) between 1 and 2048),
  source_title text not null check (char_length(source_title) between 1 and 500),
  source_type text not null check (source_type in ('official_website', 'official_contact', 'official_pricing', 'official_social', 'official_register', 'tourism_body', 'trade_body', 'reputable_directory', 'internal_record', 'manual_research')),
  source_accessed_at timestamptz not null,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  verification_status text not null default 'unverified' check (verification_status in ('verified', 'likely_valid', 'unverified', 'invalid', 'not_applicable')),
  verification_method text,
  reason text not null check (char_length(reason) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applied', 'rolled_back', 'conflict')),
  conflict_reason text,
  proposal_fingerprint text generated always as (
    md5(
      enrichment_record_id::text || '|' || target_table || '|' || target_field || '|' ||
      coalesce(previous_value, 'null'::jsonb)::text || '|' || proposed_value::text || '|' || source_url
    )
  ) stored,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  applied_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_fingerprint)
);

create table if not exists public.enrichment_email_checks (
  id uuid primary key default gen_random_uuid(),
  enrichment_record_id uuid not null references public.enrichment_records(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  normalized_email text generated always as (lower(btrim(email))) stored,
  syntax_valid boolean not null default false,
  domain text,
  domain_exists boolean,
  has_mx boolean,
  mx_hosts jsonb not null default '[]'::jsonb,
  is_disposable boolean,
  is_role_based boolean,
  known_hard_bounce boolean,
  is_suppressed boolean,
  is_opted_out boolean,
  has_prior_outreach boolean,
  domain_associated boolean,
  status text not null default 'unverified' check (status in ('verified', 'likely_valid', 'unverified', 'invalid', 'hard_bounce', 'suppressed', 'opted_out', 'not_found')),
  verification_method text,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrichment_record_id, normalized_email)
);

create table if not exists public.enrichment_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.enrichment_runs(id) on delete cascade,
  left_entity_type text not null check (left_entity_type in ('venue', 'vendor', 'supplier_application')),
  left_entity_id uuid not null,
  right_entity_type text not null check (right_entity_type in ('venue', 'vendor', 'supplier_application')),
  right_entity_id uuid not null,
  match_reasons jsonb not null default '[]'::jsonb,
  match_score numeric(5, 4) not null check (match_score between 0 and 1),
  canonical_entity_type text check (canonical_entity_type in ('venue', 'vendor', 'supplier_application')),
  canonical_entity_id uuid,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'not_duplicate', 'merged')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, left_entity_type, left_entity_id, right_entity_type, right_entity_id),
  check ((left_entity_type || ':' || left_entity_id::text) < (right_entity_type || ':' || right_entity_id::text)),
  check ((canonical_entity_type is null) = (canonical_entity_id is null)),
  check (
    canonical_entity_id is null or
    (canonical_entity_type = left_entity_type and canonical_entity_id = left_entity_id) or
    (canonical_entity_type = right_entity_type and canonical_entity_id = right_entity_id)
  )
);

create table if not exists public.enrichment_change_log (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.enrichment_field_proposals(id),
  run_id uuid not null references public.enrichment_runs(id),
  enrichment_record_id uuid not null references public.enrichment_records(id),
  action text not null check (action in ('applied', 'rolled_back')),
  target_table text not null check (target_table in ('venues', 'business_enrichment_profiles')),
  target_field text not null,
  previous_value jsonb,
  new_value jsonb,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Existing business fields are often SQL NULL before enrichment. Keep those
-- values distinct from the JSON string "null" while retaining a stable,
-- idempotent proposal fingerprint for staging and replay.
alter table public.enrichment_field_proposals
  alter column previous_value drop not null;

alter table public.enrichment_change_log
  alter column previous_value drop not null,
  alter column new_value drop not null;

do $$
declare
  v_generation_expression text;
begin
  select generation_expression
  into v_generation_expression
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'enrichment_field_proposals'
    and column_name = 'proposal_fingerprint';

  if v_generation_expression is null
     or position('COALESCE' in upper(v_generation_expression)) = 0 then
    alter table public.enrichment_field_proposals
      drop constraint if exists enrichment_field_proposals_proposal_fingerprint_key;
    alter table public.enrichment_field_proposals
      drop column proposal_fingerprint;
    alter table public.enrichment_field_proposals
      add column proposal_fingerprint text generated always as (
        md5(
          enrichment_record_id::text || '|' || target_table || '|' || target_field || '|' ||
          coalesce(previous_value, 'null'::jsonb)::text || '|' || proposed_value::text || '|' || source_url
        )
      ) stored;
    alter table public.enrichment_field_proposals
      add constraint enrichment_field_proposals_proposal_fingerprint_key unique (proposal_fingerprint);
  end if;
end $$;

create index if not exists enrichment_runs_created_by_idx on public.enrichment_runs (created_by);
create index if not exists enrichment_runs_status_created_idx on public.enrichment_runs (status, created_at desc);
create index if not exists enrichment_records_entity_idx on public.enrichment_records (entity_type, entity_id);
create index if not exists enrichment_records_pending_idx
  on public.enrichment_records (run_id, next_attempt_at, created_at)
  where requires_manual_review = false and research_status in ('pending', 'processing', 'failed');
create index if not exists enrichment_field_proposals_record_idx on public.enrichment_field_proposals (enrichment_record_id, created_at);
create index if not exists enrichment_field_proposals_reviewer_idx on public.enrichment_field_proposals (reviewed_by);
create index if not exists enrichment_field_proposals_pending_idx
  on public.enrichment_field_proposals (enrichment_record_id, created_at)
  where status in ('pending', 'approved', 'conflict');
create index if not exists enrichment_email_checks_status_idx on public.enrichment_email_checks (status, checked_at desc);
create index if not exists enrichment_duplicate_candidates_reviewer_idx on public.enrichment_duplicate_candidates (reviewed_by);
create index if not exists enrichment_duplicate_candidates_pending_idx
  on public.enrichment_duplicate_candidates (run_id, match_score desc)
  where status = 'pending';
create index if not exists business_enrichment_profiles_status_idx
  on public.business_enrichment_profiles (business_status, last_verified_at);
create index if not exists enrichment_change_log_proposal_idx on public.enrichment_change_log (proposal_id, created_at desc);
create index if not exists enrichment_change_log_run_idx on public.enrichment_change_log (run_id, created_at desc);
create index if not exists enrichment_change_log_record_idx on public.enrichment_change_log (enrichment_record_id, created_at desc);
create index if not exists enrichment_change_log_changed_by_idx on public.enrichment_change_log (changed_by);

drop trigger if exists enrichment_runs_set_updated_at on public.enrichment_runs;
create trigger enrichment_runs_set_updated_at before update on public.enrichment_runs
for each row execute function public.set_updated_at();
drop trigger if exists enrichment_records_set_updated_at on public.enrichment_records;
create trigger enrichment_records_set_updated_at before update on public.enrichment_records
for each row execute function public.set_updated_at();
drop trigger if exists business_enrichment_profiles_set_updated_at on public.business_enrichment_profiles;
create trigger business_enrichment_profiles_set_updated_at before update on public.business_enrichment_profiles
for each row execute function public.set_updated_at();
drop trigger if exists enrichment_field_proposals_set_updated_at on public.enrichment_field_proposals;
create trigger enrichment_field_proposals_set_updated_at before update on public.enrichment_field_proposals
for each row execute function public.set_updated_at();
drop trigger if exists enrichment_email_checks_set_updated_at on public.enrichment_email_checks;
create trigger enrichment_email_checks_set_updated_at before update on public.enrichment_email_checks
for each row execute function public.set_updated_at();
drop trigger if exists enrichment_duplicate_candidates_set_updated_at on public.enrichment_duplicate_candidates;
create trigger enrichment_duplicate_candidates_set_updated_at before update on public.enrichment_duplicate_candidates
for each row execute function public.set_updated_at();

create or replace function public.reject_enrichment_change_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'enrichment_change_log is append-only';
end;
$$;

drop trigger if exists enrichment_change_log_immutable on public.enrichment_change_log;
create trigger enrichment_change_log_immutable
before update or delete on public.enrichment_change_log
for each row execute function public.reject_enrichment_change_log_mutation();

create or replace function public.apply_enrichment_proposal(
  p_proposal_id uuid,
  p_reviewer_id uuid
)
returns public.enrichment_field_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.enrichment_field_proposals%rowtype;
  v_record public.enrichment_records%rowtype;
  v_current jsonb;
  v_applied jsonb;
begin
  if p_reviewer_id is null or not exists (
    select 1 from public.profiles where id = p_reviewer_id and role = 'admin'
  ) then
    raise exception 'An active admin reviewer is required' using errcode = '42501';
  end if;

  select * into v_proposal
  from public.enrichment_field_proposals
  where id = p_proposal_id
  for update;
  if not found then
    raise exception 'Enrichment proposal not found';
  end if;
  if v_proposal.status = 'applied' then
    return v_proposal;
  end if;
  if v_proposal.status <> 'approved' then
    raise exception 'Only approved enrichment proposals can be applied';
  end if;

  select * into v_record
  from public.enrichment_records
  where id = v_proposal.enrichment_record_id;
  if not found then
    raise exception 'Enrichment record not found';
  end if;

  if v_proposal.target_table = 'venues' then
    if v_record.entity_type <> 'venue' or not (
      v_proposal.target_field = any (array[
        'name', 'type', 'region', 'town', 'country', 'summary', 'description',
        'price_from', 'price_to', 'capacity_min', 'capacity_max',
        'official_website_url', 'official_gallery_url', 'vendor_contact_email',
        'vendor_contact_source_url', 'vendor_contact_verified_at', 'latitude', 'longitude'
      ]::text[])
    ) then
      raise exception 'Target venue field is not allowlisted';
    end if;

    perform 1 from public.venues where id = v_record.entity_id for update;
    if not found then raise exception 'Target venue not found'; end if;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(v.%I), ''null''::jsonb) from public.venues v where v.id = $1',
      v_proposal.target_field
    ) into v_current using v_record.entity_id;
  elsif v_proposal.target_table = 'business_enrichment_profiles' then
    if not (
      v_proposal.target_field = any (array[
        'trading_name', 'contact_page_url', 'enquiry_page_url', 'public_email',
        'enquiries_email', 'wedding_email', 'sales_email', 'phone', 'full_address',
        'address_line_1', 'address_line_2', 'town', 'county_region', 'country',
        'postcode', 'instagram_url', 'facebook_url', 'tiktok_url', 'linkedin_url',
        'services', 'areas_served', 'structured_pricing', 'business_status', 'last_verified_at'
      ]::text[])
    ) then
      raise exception 'Target enrichment profile field is not allowlisted';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('everaft_enrichment_profile:' || v_record.entity_type || ':' || v_record.entity_id::text, 0)
    );
    insert into public.business_enrichment_profiles (entity_type, entity_id)
    values (v_record.entity_type, v_record.entity_id)
    on conflict (entity_type, entity_id) do nothing;
    perform 1 from public.business_enrichment_profiles
      where entity_type = v_record.entity_type and entity_id = v_record.entity_id
      for update;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(p.%I), ''null''::jsonb) from public.business_enrichment_profiles p where p.entity_type = $1 and p.entity_id = $2',
      v_proposal.target_field
    ) into v_current using v_record.entity_type, v_record.entity_id;
  else
    raise exception 'Target table is not allowlisted';
  end if;

  if v_current is distinct from v_proposal.previous_value then
    update public.enrichment_field_proposals
    set status = 'conflict',
        conflict_reason = 'Current value no longer matches the approved previous value.'
    where id = v_proposal.id
    returning * into v_proposal;
    return v_proposal;
  end if;

  if v_proposal.target_table = 'venues' then
    execute pg_catalog.format(
      'update public.venues set %1$I = (pg_catalog.jsonb_populate_record(null::public.venues, pg_catalog.jsonb_build_object(%2$L, $1))).%1$I where id = $2',
      v_proposal.target_field,
      v_proposal.target_field
    ) using v_proposal.proposed_value, v_record.entity_id;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(v.%I), ''null''::jsonb) from public.venues v where v.id = $1',
      v_proposal.target_field
    ) into v_applied using v_record.entity_id;
  else
    execute pg_catalog.format(
      'update public.business_enrichment_profiles set %1$I = (pg_catalog.jsonb_populate_record(null::public.business_enrichment_profiles, pg_catalog.jsonb_build_object(%2$L, $1))).%1$I where entity_type = $2 and entity_id = $3',
      v_proposal.target_field,
      v_proposal.target_field
    ) using v_proposal.proposed_value, v_record.entity_type, v_record.entity_id;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(p.%I), ''null''::jsonb) from public.business_enrichment_profiles p where p.entity_type = $1 and p.entity_id = $2',
      v_proposal.target_field
    ) into v_applied using v_record.entity_type, v_record.entity_id;
  end if;

  insert into public.enrichment_change_log (
    proposal_id, run_id, enrichment_record_id, action, target_table, target_field,
    previous_value, new_value, changed_by
  ) values (
    v_proposal.id, v_record.run_id, v_record.id, 'applied',
    v_proposal.target_table, v_proposal.target_field, v_current, v_applied, p_reviewer_id
  );

  update public.enrichment_field_proposals
  set status = 'applied',
      conflict_reason = null,
      reviewed_by = coalesce(reviewed_by, p_reviewer_id),
      reviewed_at = coalesce(reviewed_at, pg_catalog.now()),
      applied_at = pg_catalog.now()
  where id = v_proposal.id
  returning * into v_proposal;
  return v_proposal;
end;
$$;

comment on function public.apply_enrichment_proposal(uuid, uuid) is
  'Returns the current proposal row. Callers must inspect status: only applied confirms success; conflict means no target business field was changed.';

create or replace function public.rollback_enrichment_proposal(
  p_proposal_id uuid,
  p_reviewer_id uuid
)
returns public.enrichment_field_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.enrichment_field_proposals%rowtype;
  v_record public.enrichment_records%rowtype;
  v_change public.enrichment_change_log%rowtype;
  v_current jsonb;
  v_restored jsonb;
begin
  if p_reviewer_id is null or not exists (
    select 1 from public.profiles where id = p_reviewer_id and role = 'admin'
  ) then
    raise exception 'An active admin reviewer is required' using errcode = '42501';
  end if;

  select * into v_proposal
  from public.enrichment_field_proposals
  where id = p_proposal_id
  for update;
  if not found then raise exception 'Enrichment proposal not found'; end if;
  if v_proposal.status = 'rolled_back' then return v_proposal; end if;
  if v_proposal.status <> 'applied' then
    raise exception 'Only applied enrichment proposals can be rolled back';
  end if;

  select * into v_record from public.enrichment_records where id = v_proposal.enrichment_record_id;
  if not found then raise exception 'Enrichment record not found'; end if;
  select * into v_change
  from public.enrichment_change_log
  where proposal_id = v_proposal.id and action = 'applied'
  order by created_at desc
  limit 1;
  if not found then raise exception 'Applied change log entry not found'; end if;

  if v_proposal.target_table = 'venues' then
    if v_record.entity_type <> 'venue' or not (
      v_proposal.target_field = any (array[
        'name', 'type', 'region', 'town', 'country', 'summary', 'description',
        'price_from', 'price_to', 'capacity_min', 'capacity_max',
        'official_website_url', 'official_gallery_url', 'vendor_contact_email',
        'vendor_contact_source_url', 'vendor_contact_verified_at', 'latitude', 'longitude'
      ]::text[])
    ) then raise exception 'Target venue field is not allowlisted'; end if;
    perform 1 from public.venues where id = v_record.entity_id for update;
    if not found then raise exception 'Target venue not found'; end if;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(v.%I), ''null''::jsonb) from public.venues v where v.id = $1',
      v_proposal.target_field
    ) into v_current using v_record.entity_id;
  elsif v_proposal.target_table = 'business_enrichment_profiles' then
    if not (
      v_proposal.target_field = any (array[
        'trading_name', 'contact_page_url', 'enquiry_page_url', 'public_email',
        'enquiries_email', 'wedding_email', 'sales_email', 'phone', 'full_address',
        'address_line_1', 'address_line_2', 'town', 'county_region', 'country',
        'postcode', 'instagram_url', 'facebook_url', 'tiktok_url', 'linkedin_url',
        'services', 'areas_served', 'structured_pricing', 'business_status', 'last_verified_at'
      ]::text[])
    ) then raise exception 'Target enrichment profile field is not allowlisted'; end if;
    perform 1 from public.business_enrichment_profiles
      where entity_type = v_record.entity_type and entity_id = v_record.entity_id
      for update;
    if not found then raise exception 'Target enrichment profile not found'; end if;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(p.%I), ''null''::jsonb) from public.business_enrichment_profiles p where p.entity_type = $1 and p.entity_id = $2',
      v_proposal.target_field
    ) into v_current using v_record.entity_type, v_record.entity_id;
  else
    raise exception 'Target table is not allowlisted';
  end if;

  if v_current is distinct from v_change.new_value then
    update public.enrichment_field_proposals
    set status = 'conflict',
        conflict_reason = 'Current value changed after enrichment was applied; rollback requires manual review.'
    where id = v_proposal.id
    returning * into v_proposal;
    return v_proposal;
  end if;

  if v_proposal.target_table = 'venues' then
    execute pg_catalog.format(
      'update public.venues set %1$I = (pg_catalog.jsonb_populate_record(null::public.venues, pg_catalog.jsonb_build_object(%2$L, $1))).%1$I where id = $2',
      v_proposal.target_field,
      v_proposal.target_field
    ) using v_change.previous_value, v_record.entity_id;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(v.%I), ''null''::jsonb) from public.venues v where v.id = $1',
      v_proposal.target_field
    ) into v_restored using v_record.entity_id;
  else
    execute pg_catalog.format(
      'update public.business_enrichment_profiles set %1$I = (pg_catalog.jsonb_populate_record(null::public.business_enrichment_profiles, pg_catalog.jsonb_build_object(%2$L, $1))).%1$I where entity_type = $2 and entity_id = $3',
      v_proposal.target_field,
      v_proposal.target_field
    ) using v_change.previous_value, v_record.entity_type, v_record.entity_id;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(p.%I), ''null''::jsonb) from public.business_enrichment_profiles p where p.entity_type = $1 and p.entity_id = $2',
      v_proposal.target_field
    ) into v_restored using v_record.entity_type, v_record.entity_id;
  end if;

  insert into public.enrichment_change_log (
    proposal_id, run_id, enrichment_record_id, action, target_table, target_field,
    previous_value, new_value, changed_by
  ) values (
    v_proposal.id, v_record.run_id, v_record.id, 'rolled_back',
    v_proposal.target_table, v_proposal.target_field, v_current, v_restored, p_reviewer_id
  );

  update public.enrichment_field_proposals
  set status = 'rolled_back',
      conflict_reason = null,
      rolled_back_at = pg_catalog.now()
  where id = v_proposal.id
  returning * into v_proposal;
  return v_proposal;
end;
$$;

comment on function public.rollback_enrichment_proposal(uuid, uuid) is
  'Returns the current proposal row. Callers must inspect status: only rolled_back confirms success; conflict means no target business field was changed.';

create or replace function public.claim_enrichment_records(
  p_run_id uuid,
  p_worker_id text,
  p_limit integer default 10
)
returns setof public.enrichment_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 100);
begin
  if p_worker_id is null or pg_catalog.char_length(pg_catalog.btrim(p_worker_id)) not between 1 and 120 then
    raise exception 'A worker identifier between 1 and 120 characters is required';
  end if;

  return query
  with picked as (
    select r.id
    from public.enrichment_records r
    where r.run_id = p_run_id
      and r.requires_manual_review = false
      and (r.next_attempt_at is null or r.next_attempt_at <= pg_catalog.now())
      and (r.locked_at is null or r.locked_at < pg_catalog.now() - interval '15 minutes')
      and (
        r.research_status in ('pending', 'failed') or
        (r.research_status = 'processing' and r.locked_at < pg_catalog.now() - interval '15 minutes')
      )
    order by r.created_at, r.id
    limit v_limit
    for update skip locked
  )
  update public.enrichment_records r
  set research_status = 'processing',
      locked_by = pg_catalog.btrim(p_worker_id),
      locked_at = pg_catalog.now(),
      attempt_count = r.attempt_count + 1,
      last_error = null
  from picked
  where r.id = picked.id
  returning r.*;
end;
$$;

alter table public.enrichment_runs enable row level security;
alter table public.enrichment_records enable row level security;
alter table public.business_enrichment_profiles enable row level security;
alter table public.enrichment_field_proposals enable row level security;
alter table public.enrichment_email_checks enable row level security;
alter table public.enrichment_duplicate_candidates enable row level security;
alter table public.enrichment_change_log enable row level security;

revoke all on public.enrichment_runs from anon, authenticated;
revoke all on public.enrichment_records from anon, authenticated;
revoke all on public.business_enrichment_profiles from anon, authenticated;
revoke all on public.enrichment_field_proposals from anon, authenticated;
revoke all on public.enrichment_email_checks from anon, authenticated;
revoke all on public.enrichment_duplicate_candidates from anon, authenticated;
revoke all on public.enrichment_change_log from anon, authenticated;

grant usage on schema public to service_role;
grant select on table
  public.venues,
  public.venue_amenities,
  public.supplier_applications,
  public.outreach_suppressions,
  public.outreach_campaign_recipients
to service_role;
grant select, insert, update, delete on table
  public.enrichment_runs,
  public.enrichment_records,
  public.business_enrichment_profiles,
  public.enrichment_field_proposals,
  public.enrichment_email_checks,
  public.enrichment_duplicate_candidates
to service_role;
grant select on table public.enrichment_change_log to service_role;

revoke execute on function public.reject_enrichment_change_log_mutation() from public, anon, authenticated;
revoke execute on function public.apply_enrichment_proposal(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.rollback_enrichment_proposal(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.claim_enrichment_records(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.apply_enrichment_proposal(uuid, uuid) to service_role;
grant execute on function public.rollback_enrichment_proposal(uuid, uuid) to service_role;
grant execute on function public.claim_enrichment_records(uuid, text, integer) to service_role;

notify pgrst, 'reload schema';
