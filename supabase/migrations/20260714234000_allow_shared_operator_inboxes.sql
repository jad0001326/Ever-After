-- A legitimate operator can publish one weddings inbox for several distinct
-- venues. Retain shared-email evidence, but do not turn it into an outreach
-- blocker or a venue-duplicate warning. Campaign sending remains deduplicated
-- by normalized email, so this cannot create repeated emails to that inbox.

do $$
declare
  v_definition text;
  v_duplicate_blocker text := '  if v_duplicate_email then v_blockers := array_append(v_blockers, ''duplicate_email''); end if;';
begin
  select pg_get_functiondef(procedure.oid)
  into v_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'verify_enrichment_contact'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_enrichment_record_id uuid, p_email text, p_source_url text, p_verification_method text, p_verification_note text, p_reviewer_id uuid, p_expected_updated_at timestamp with time zone';

  if v_definition is null then
    raise exception 'verify_enrichment_contact function was not found';
  end if;
  if position(v_duplicate_blocker in v_definition) = 0 then
    raise exception 'verify_enrichment_contact did not contain the expected duplicate-email blocker';
  end if;

  v_definition := replace(v_definition, v_duplicate_blocker || chr(10), '');
  execute v_definition;
end;
$$;

-- The function is internal-only. Reassert the deliberately narrow execution
-- grant after recreating it.
revoke execute on function public.verify_enrichment_contact(uuid, text, text, text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.verify_enrichment_contact(uuid, text, text, text, text, uuid, timestamptz) to service_role;

-- Bring the current operational view of older review records into line with
-- the corrected rule. Historical before/after audit fields are intentionally
-- left untouched.
with affected as (
  select
    record.id,
    array_remove(record.current_eligibility_blockers, 'duplicate_email') as blockers,
    coalesce(record.entity_snapshot, '{}'::jsonb) as snapshot
  from public.enrichment_records record
  where 'duplicate_email' = any(coalesce(record.current_eligibility_blockers, '{}'::text[]))
)
update public.enrichment_records record
set current_eligibility_blockers = affected.blockers,
    current_outreach_eligible = cardinality(affected.blockers) = 0,
    eligibility_recalculated_at = now(),
    entity_snapshot = jsonb_set(
      jsonb_set(
        jsonb_set(affected.snapshot, '{safetyBlockers}', to_jsonb(affected.blockers), true),
        '{recommendedForOutreach}',
        to_jsonb(cardinality(affected.blockers) = 0 and not record.requires_manual_review),
        true
      ),
      '{exactEligibilityBlockersAfter}',
      to_jsonb(affected.blockers),
      true
    )
from affected
where record.id = affected.id;
