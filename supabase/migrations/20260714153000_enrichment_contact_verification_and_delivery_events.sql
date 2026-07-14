-- Make manual contact verification a single, auditable operation and retain
-- enough delivery evidence to show accurate campaign outcomes.

alter table public.enrichment_records
  add column if not exists current_outreach_eligible boolean,
  add column if not exists current_eligibility_blockers text[] not null default '{}'::text[],
  add column if not exists eligibility_recalculated_at timestamptz;

update public.enrichment_records
set current_outreach_eligible = coalesce(current_outreach_eligible, after_outreach_eligible, before_outreach_eligible),
    current_eligibility_blockers = case
      when cardinality(current_eligibility_blockers) = 0 then eligibility_blockers
      else current_eligibility_blockers
    end
where current_outreach_eligible is null or cardinality(current_eligibility_blockers) = 0;

alter table public.enrichment_email_checks
  add column if not exists candidate_role text not null default 'unknown',
  add column if not exists is_current_candidate boolean not null default false,
  add column if not exists source_url text,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'enrichment_email_checks_candidate_role_check'
  ) then
    alter table public.enrichment_email_checks
      add constraint enrichment_email_checks_candidate_role_check
      check (candidate_role in ('venue_contact', 'third_party_reference', 'unknown'));
  end if;
end;
$$;

create unique index if not exists enrichment_email_checks_one_current_candidate_idx
  on public.enrichment_email_checks (enrichment_record_id)
  where is_current_candidate;

create table if not exists public.enrichment_contact_verification_log (
  id uuid primary key default gen_random_uuid(),
  enrichment_record_id uuid not null references public.enrichment_records(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  previous_email text,
  new_email text not null,
  previous_source_url text,
  new_source_url text not null,
  verification_method text not null,
  verification_note text,
  previous_blockers text[] not null default '{}'::text[],
  new_blockers text[] not null default '{}'::text[],
  previous_eligible boolean,
  new_eligible boolean not null,
  verified_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.enrichment_contact_verification_log enable row level security;
revoke all on public.enrichment_contact_verification_log from public, anon, authenticated;
grant all on public.enrichment_contact_verification_log to service_role;

create or replace function public.reject_enrichment_contact_verification_log_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Contact verification audit entries are immutable';
end;
$$;

drop trigger if exists enrichment_contact_verification_log_immutable on public.enrichment_contact_verification_log;
create trigger enrichment_contact_verification_log_immutable
before update or delete on public.enrichment_contact_verification_log
for each row execute function public.reject_enrichment_contact_verification_log_mutation();

alter table public.outreach_campaign_recipients
  add column if not exists last_event_at timestamptz,
  add column if not exists bounce_type text,
  add column if not exists bounce_subtype text,
  add column if not exists bounce_message text;

alter table public.outreach_email_events
  add column if not exists event_data jsonb not null default '{}'::jsonb;

create or replace function public.verify_enrichment_contact(
  p_enrichment_record_id uuid,
  p_email text,
  p_source_url text,
  p_verification_method text,
  p_verification_note text,
  p_reviewer_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.enrichment_records%rowtype;
  v_venue public.venues%rowtype;
  v_latest_record_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_source_url text := btrim(coalesce(p_source_url, ''));
  v_method text := btrim(coalesce(p_verification_method, ''));
  v_note text := nullif(btrim(left(coalesce(p_verification_note, ''), 2000)), '');
  v_old_email text;
  v_old_source_url text;
  v_source_host text;
  v_official_host text;
  v_blockers text[] := '{}'::text[];
  v_previous_blockers text[] := '{}'::text[];
  v_quality_blockers text[] := '{}'::text[];
  v_missing_fields text[] := '{}'::text[];
  v_snapshot jsonb;
  v_duplicate_email boolean := false;
  v_suppressed boolean := false;
  v_existing_history boolean := false;
  v_current_eligible boolean := false;
  v_requires_manual_review boolean := false;
  v_invite_status text;
begin
  if p_reviewer_id is null or not exists (
    select 1 from public.profiles where id = p_reviewer_id and role = 'admin'
  ) then
    raise exception 'An active admin reviewer is required' using errcode = '42501';
  end if;

  if v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' or char_length(v_email) > 254 then
    raise exception 'Enter a valid business email address' using errcode = '22023';
  end if;
  if v_source_url !~* '^https?://[^[:space:]/]+(?:/.*)?$' or char_length(v_source_url) > 2048 then
    raise exception 'Enter a public http or https source URL' using errcode = '22023';
  end if;
  if v_method not in ('official_website', 'official_contact_page', 'venue_confirmation', 'manual_admin_verification') then
    raise exception 'Choose a valid verification method' using errcode = '22023';
  end if;

  select * into v_record
  from public.enrichment_records
  where id = p_enrichment_record_id
  for update;
  if not found or v_record.entity_type <> 'venue' then
    raise exception 'Venue enrichment record not found' using errcode = 'P0002';
  end if;
  if p_expected_updated_at is null or v_record.updated_at is distinct from p_expected_updated_at then
    raise exception 'This review changed while it was open. Reload it before saving.' using errcode = '40001';
  end if;

  select r.id into v_latest_record_id
  from public.enrichment_records r
  join public.enrichment_runs run on run.id = r.run_id
  where r.entity_type = v_record.entity_type
    and r.entity_id = v_record.entity_id
    and run.mode = 'review'
    and run.status = 'completed'
  order by r.created_at desc
  limit 1;
  if v_latest_record_id is distinct from v_record.id then
    raise exception 'Open the latest completed enrichment review before verifying this contact' using errcode = '40001';
  end if;

  select * into v_venue
  from public.venues
  where id = v_record.entity_id
  for update;
  if not found then
    raise exception 'Venue not found' using errcode = 'P0002';
  end if;

  v_source_host := lower(regexp_replace(regexp_replace(v_source_url, '^https?://', '', 'i'), '/.*$', ''));
  v_source_host := regexp_replace(v_source_host, '^www\\.', '');
  v_official_host := lower(regexp_replace(regexp_replace(coalesce(v_venue.official_website_url, ''), '^https?://', '', 'i'), '/.*$', ''));
  v_official_host := regexp_replace(v_official_host, '^www\\.', '');
  if v_method in ('official_website', 'official_contact_page') and (v_official_host = '' or v_source_host <> v_official_host) then
    raise exception 'Official-source verification must use a page on this venue''s official website' using errcode = '22023';
  end if;

  v_old_email := lower(btrim(coalesce(v_venue.vendor_contact_email, '')));
  v_old_source_url := v_venue.vendor_contact_source_url;
  v_previous_blockers := coalesce(v_record.current_eligibility_blockers, v_record.eligibility_blockers, '{}'::text[]);

  select exists (
    select 1 from public.venues other
    where other.id <> v_venue.id
      and lower(btrim(coalesce(other.vendor_contact_email, ''))) = v_email
  ) into v_duplicate_email;
  select exists (
    select 1 from public.outreach_suppressions s where s.normalized_email = v_email
  ) into v_suppressed;
  select exists (
    select 1 from public.outreach_campaign_recipients recipient
    where recipient.venue_id = v_venue.id
      and recipient.status in ('sent', 'delivered', 'failed', 'complained', 'replied', 'unsubscribed', 'suppressed')
  ) into v_existing_history;

  v_invite_status := v_venue.invite_status;
  if v_venue.invite_status = 'bounced'
    and v_old_email <> v_email
    and not v_suppressed
    and not v_existing_history then
    v_invite_status := 'not_sent';
  end if;

  update public.venues
  set vendor_contact_email = v_email,
      vendor_contact_source_url = v_source_url,
      vendor_contact_verified_at = now(),
      vendor_contact_verified_by = p_reviewer_id,
      invite_status = v_invite_status,
      invite_sent_at = case when v_invite_status = 'not_sent' then null else invite_sent_at end
  where id = v_venue.id;

  insert into public.business_enrichment_profiles (
    entity_type, entity_id, public_email, contact_page_url, last_verified_at
  ) values (
    'venue', v_venue.id, v_email, v_source_url, now()
  ) on conflict (entity_type, entity_id) do update
  set public_email = excluded.public_email,
      contact_page_url = excluded.contact_page_url,
      last_verified_at = excluded.last_verified_at;

  update public.enrichment_email_checks
  set is_current_candidate = false,
      superseded_at = case when is_current_candidate then now() else superseded_at end,
      superseded_by = case when is_current_candidate then p_reviewer_id else superseded_by end
  where enrichment_record_id = v_record.id
    and is_current_candidate;

  insert into public.enrichment_email_checks (
    enrichment_record_id, email, syntax_valid, domain, domain_associated,
    status, verification_method, details, checked_at, candidate_role,
    is_current_candidate, source_url, superseded_at, superseded_by
  ) values (
    v_record.id, v_email, true, split_part(v_email, '@', 2), true,
    'verified', v_method,
    jsonb_strip_nulls(jsonb_build_object('source_url', v_source_url, 'verification_note', v_note, 'verification_scope', 'manual_official_source')),
    now(), 'venue_contact', true, v_source_url, null, null
  ) on conflict (enrichment_record_id, normalized_email) do update
  set syntax_valid = true,
      domain = excluded.domain,
      domain_associated = true,
      status = 'verified',
      verification_method = excluded.verification_method,
      details = excluded.details,
      checked_at = excluded.checked_at,
      candidate_role = 'venue_contact',
      is_current_candidate = true,
      source_url = excluded.source_url,
      superseded_at = null,
      superseded_by = null;

  if v_venue.is_claimed is distinct from false then v_blockers := array_append(v_blockers, 'claimed'); end if;
  if v_venue.listing_status <> 'published' then v_blockers := array_append(v_blockers, 'listing_not_published'); end if;
  if v_venue.country <> 'Scotland' then v_blockers := array_append(v_blockers, 'country_mismatch'); end if;
  if v_invite_status <> 'not_sent' then v_blockers := array_append(v_blockers, 'invite_not_available'); end if;
  if v_duplicate_email then v_blockers := array_append(v_blockers, 'duplicate_email'); end if;
  if v_suppressed then v_blockers := array_append(v_blockers, 'suppressed'); end if;
  if v_existing_history then v_blockers := array_append(v_blockers, 'existing_outreach'); end if;

  v_current_eligible := cardinality(v_blockers) = 0;
  v_requires_manual_review := v_record.business_status in ('temporarily_closed', 'rebranded', 'duplicate', 'uncertain');
  v_quality_blockers := array_remove(array_remove(array_remove(v_record.quality_blockers, 'missing_email'), 'invalid_email'), 'unverified_contact');
  v_missing_fields := array_remove(v_record.missing_fields, 'email');
  v_snapshot := coalesce(v_record.entity_snapshot, '{}'::jsonb);
  v_snapshot := jsonb_set(v_snapshot, '{publicEmail}', to_jsonb(v_email), true);
  v_snapshot := jsonb_set(v_snapshot, '{contactSourceUrl}', to_jsonb(v_source_url), true);
  v_snapshot := jsonb_set(v_snapshot, '{researchStatus}', to_jsonb('verified'::text), true);
  v_snapshot := jsonb_set(v_snapshot, '{dataQualityIssues}', to_jsonb(v_quality_blockers), true);
  v_snapshot := jsonb_set(v_snapshot, '{safetyBlockers}', to_jsonb(v_blockers), true);
  v_snapshot := jsonb_set(v_snapshot, '{requiresManualReview}', to_jsonb(v_requires_manual_review), true);
  v_snapshot := jsonb_set(v_snapshot, '{recommendedForOutreach}', to_jsonb(v_current_eligible and not v_requires_manual_review), true);
  v_snapshot := jsonb_set(v_snapshot, '{exactEligibilityBlockersAfter}', to_jsonb(v_blockers), true);
  v_snapshot := jsonb_set(v_snapshot, '{eligibleUnderCurrentRulesAfter}', to_jsonb(v_current_eligible), true);
  v_snapshot := jsonb_set(v_snapshot, '{eligibleAfterCampaignCap}', to_jsonb(v_current_eligible), true);

  update public.enrichment_records
  set entity_snapshot = v_snapshot,
      eligibility_blockers = v_blockers,
      current_eligibility_blockers = v_blockers,
      current_outreach_eligible = v_current_eligible,
      eligibility_recalculated_at = now(),
      quality_blockers = v_quality_blockers,
      missing_fields = v_missing_fields,
      research_status = 'verified',
      requires_manual_review = v_requires_manual_review,
      after_outreach_eligible = v_current_eligible,
      locked_by = null,
      locked_at = null,
      next_attempt_at = null,
      last_error = null
  where id = v_record.id;

  insert into public.enrichment_contact_verification_log (
    enrichment_record_id, venue_id, previous_email, new_email, previous_source_url,
    new_source_url, verification_method, verification_note, previous_blockers,
    new_blockers, previous_eligible, new_eligible, verified_by
  ) values (
    v_record.id, v_venue.id, nullif(v_old_email, ''), v_email, v_old_source_url,
    v_source_url, v_method, v_note, v_previous_blockers, v_blockers,
    v_record.current_outreach_eligible, v_current_eligible, p_reviewer_id
  );

  return jsonb_build_object(
    'record_id', v_record.id,
    'venue_id', v_venue.id,
    'email', v_email,
    'source_url', v_source_url,
    'eligible', v_current_eligible,
    'blockers', v_blockers,
    'requires_manual_review', v_requires_manual_review,
    'invite_status', v_invite_status
  );
end;
$$;

revoke execute on function public.verify_enrichment_contact(uuid, text, text, text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.verify_enrichment_contact(uuid, text, text, text, text, uuid, timestamptz) to service_role;

create or replace function public.record_outreach_email_event(
  p_event_id text,
  p_resend_email_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_event_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient public.outreach_campaign_recipients%rowtype;
  v_event_time timestamptz := coalesce(p_event_created_at, now());
  v_status text;
  v_suppression_reason text;
  v_should_apply boolean := false;
  v_is_new_event boolean := false;
begin
  if p_event_id is null or char_length(p_event_id) > 255 or p_resend_email_id is null or char_length(p_resend_email_id) > 255 then
    raise exception 'Invalid delivery event identifiers' using errcode = '22023';
  end if;

  insert into public.outreach_email_events (id, resend_email_id, event_type, event_created_at, event_data)
  values (p_event_id, p_resend_email_id, p_event_type, p_event_created_at, coalesce(p_event_data, '{}'::jsonb))
  on conflict (id) do nothing
  returning true into v_is_new_event;
  if not coalesce(v_is_new_event, false) then
    return jsonb_build_object('duplicate', true, 'matched', false, 'applied', false);
  end if;

  select * into v_recipient
  from public.outreach_campaign_recipients
  where resend_email_id = p_resend_email_id
  for update;
  if not found then
    return jsonb_build_object('duplicate', false, 'matched', false, 'applied', false);
  end if;

  v_status := case p_event_type
    when 'email.delivered' then 'delivered'
    when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained'
    when 'email.suppressed' then 'suppressed'
    when 'email.failed' then 'failed'
    else null
  end;
  if v_status is null then
    return jsonb_build_object('duplicate', false, 'matched', true, 'applied', false);
  end if;

  v_should_apply := v_recipient.last_event_at is null or v_event_time >= v_recipient.last_event_at;
  if v_status = 'delivered' and v_recipient.status in ('bounced', 'complained', 'suppressed', 'unsubscribed') then
    v_should_apply := false;
  end if;
  if not v_should_apply then
    return jsonb_build_object('duplicate', false, 'matched', true, 'applied', false, 'reason', 'older_event');
  end if;

  update public.outreach_campaign_recipients
  set status = v_status,
      delivered_at = case when v_status = 'delivered' then v_event_time else delivered_at end,
      error_message = case
        when v_status in ('bounced', 'failed', 'suppressed', 'complained') then nullif(left(coalesce(p_event_data->>'diagnostic_message', p_event_data->>'reason', ''), 2000), '')
        when v_status = 'delivered' then null
        else error_message
      end,
      last_event_at = v_event_time,
      bounce_type = case when v_status = 'bounced' then nullif(left(coalesce(p_event_data->>'bounce_type', ''), 120), '') else bounce_type end,
      bounce_subtype = case when v_status = 'bounced' then nullif(left(coalesce(p_event_data->>'bounce_subtype', ''), 120), '') else bounce_subtype end,
      bounce_message = case when v_status = 'bounced' then nullif(left(coalesce(p_event_data->>'diagnostic_message', p_event_data->>'reason', ''), 2000), '') else bounce_message end
  where id = v_recipient.id;

  v_suppression_reason := case p_event_type
    when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained'
    when 'email.suppressed' then 'provider_suppressed'
    else null
  end;
  if v_suppression_reason is not null then
    insert into public.outreach_suppressions (email, reason, source)
    values (v_recipient.email, v_suppression_reason, 'resend_webhook')
    on conflict (normalized_email) do update set reason = excluded.reason, source = excluded.source;
  end if;
  if v_recipient.venue_id is not null and p_event_type in ('email.bounced', 'email.suppressed') then
    update public.venues set invite_status = 'bounced' where id = v_recipient.venue_id;
  end if;

  return jsonb_build_object('duplicate', false, 'matched', true, 'applied', true, 'status', v_status);
end;
$$;

revoke execute on function public.record_outreach_email_event(text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.record_outreach_email_event(text, text, text, timestamptz, jsonb) to service_role;
