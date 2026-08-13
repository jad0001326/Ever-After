-- Do not count a draft recipient as past outreach when the campaign
-- preparation flow verifies a newly researched contact.

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
