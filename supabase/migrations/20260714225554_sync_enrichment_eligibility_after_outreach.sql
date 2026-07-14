-- Keep the enrichment review's current eligibility in sync with a venue that
-- has already been contacted. Audit "before" and "after" values remain
-- historical; only the current operational state is updated.

create or replace function public.sync_enrichment_eligibility_after_outreach()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.invite_status = 'not_sent' then
    return new;
  end if;

  with affected as (
    select
      record.id,
      array(
        select distinct blocker
        from unnest(
          coalesce(record.current_eligibility_blockers, record.eligibility_blockers, '{}'::text[])
          || array['invite_not_available', 'existing_outreach']::text[]
        ) as blocker
        where btrim(blocker) <> ''
        order by blocker
      ) as blockers,
      coalesce(record.entity_snapshot, '{}'::jsonb) as snapshot
    from public.enrichment_records record
    where record.entity_type = 'venue'
      and record.entity_id = new.id
  )
  update public.enrichment_records record
  set current_outreach_eligible = false,
      current_eligibility_blockers = affected.blockers,
      eligibility_recalculated_at = now(),
      entity_snapshot = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(affected.snapshot, '{safetyBlockers}', to_jsonb(affected.blockers), true),
              '{recommendedForOutreach}', to_jsonb(false), true
            ),
            '{exactEligibilityBlockersAfter}', to_jsonb(affected.blockers), true
          ),
          '{eligibleUnderCurrentRulesAfter}', to_jsonb(false), true
        ),
        '{eligibleAfterCampaignCap}', to_jsonb(false), true
      )
  from affected
  where record.id = affected.id;

  return new;
end;
$$;

revoke all on function public.sync_enrichment_eligibility_after_outreach() from public, anon, authenticated;

drop trigger if exists venues_sync_enrichment_eligibility_after_outreach on public.venues;
create trigger venues_sync_enrichment_eligibility_after_outreach
after update of invite_status on public.venues
for each row
when (new.invite_status is distinct from old.invite_status)
execute function public.sync_enrichment_eligibility_after_outreach();

-- Repair every review record that was staged before the trigger existed.
with affected as (
  select
    record.id,
    array(
      select distinct blocker
      from unnest(
        coalesce(record.current_eligibility_blockers, record.eligibility_blockers, '{}'::text[])
        || array['invite_not_available', 'existing_outreach']::text[]
      ) as blocker
      where btrim(blocker) <> ''
      order by blocker
    ) as blockers,
    coalesce(record.entity_snapshot, '{}'::jsonb) as snapshot
  from public.enrichment_records record
  join public.venues venue on venue.id = record.entity_id
  where record.entity_type = 'venue'
    and venue.invite_status <> 'not_sent'
)
update public.enrichment_records record
set current_outreach_eligible = false,
    current_eligibility_blockers = affected.blockers,
    eligibility_recalculated_at = now(),
    entity_snapshot = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(affected.snapshot, '{safetyBlockers}', to_jsonb(affected.blockers), true),
            '{recommendedForOutreach}', to_jsonb(false), true
          ),
          '{exactEligibilityBlockersAfter}', to_jsonb(affected.blockers), true
        ),
        '{eligibleUnderCurrentRulesAfter}', to_jsonb(false), true
      ),
      '{eligibleAfterCampaignCap}', to_jsonb(false), true
    )
from affected
where record.id = affected.id;
