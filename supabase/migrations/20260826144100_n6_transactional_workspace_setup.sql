create or replace function public.update_planning_workspace_setup_v1(
  target_workspace_id uuid,
  setup_total_budget_pence bigint,
  setup_wedding_date date,
  setup_guest_count integer,
  setup_location text,
  setup_date_flexibility text,
  setup_location_flexible boolean,
  setup_priorities text[],
  setup_venue_styles text[],
  setup_photography_styles text[],
  setup_vision text,
  expected_workspace_updated_at timestamptz,
  expected_budget_updated_at timestamptz,
  expected_profile_updated_at timestamptz
)
returns table (
  workspace_updated_at timestamptz,
  budget_updated_at timestamptz,
  profile_updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  workspace_owner_id uuid;
  workspace_budget_plan_id text;
  current_workspace_version timestamptz;
  current_budget_version timestamptz;
  current_profile_version timestamptz;
  next_budget_version timestamptz;
  next_profile_version timestamptz;
  next_workspace_version timestamptz;
  normalized_location text;
  normalized_vision text;
  normalized_priorities text[];
  normalized_venue_styles text[];
  normalized_photography_styles text[];
begin
  if current_user_id is null then
    raise exception 'Authentication is required to update wedding setup'
      using errcode = 'insufficient_privilege';
  end if;

  if target_workspace_id is null
    or expected_workspace_updated_at is null
    or expected_budget_updated_at is null
    or setup_total_budget_pence is null
    or setup_total_budget_pence not between 0 and 1000000000
    or setup_guest_count is not null and setup_guest_count not between 1 and 10000
    or setup_date_flexibility not in ('fixed', 'few_days', 'few_weeks', 'season_only', 'not_set')
    or setup_location_flexible is null
    or setup_priorities is null
    or setup_venue_styles is null
    or setup_photography_styles is null
  then
    raise exception 'Wedding setup contains invalid values'
      using errcode = 'invalid_parameter_value';
  end if;

  normalized_location := case
    when setup_location is null then null
    else nullif(pg_catalog.btrim(setup_location), '')
  end;
  normalized_vision := case
    when setup_vision is null then null
    else nullif(pg_catalog.btrim(setup_vision), '')
  end;
  normalized_priorities := array(
    select pg_catalog.btrim(value)
    from pg_catalog.unnest(setup_priorities) value
  );
  normalized_venue_styles := array(
    select pg_catalog.btrim(value)
    from pg_catalog.unnest(setup_venue_styles) value
  );
  normalized_photography_styles := array(
    select pg_catalog.btrim(value)
    from pg_catalog.unnest(setup_photography_styles) value
  );

  if setup_location is not null and normalized_location is null
    or setup_location is not null and pg_catalog.char_length(normalized_location) > 160
    or setup_vision is not null and pg_catalog.char_length(coalesce(normalized_vision, '')) > 1000
    or pg_catalog.cardinality(normalized_priorities) > 5
    or pg_catalog.cardinality(normalized_venue_styles) > 8
    or pg_catalog.cardinality(normalized_photography_styles) > 8
    or exists (
      select 1
      from pg_catalog.unnest(normalized_priorities) value
      where value is null
        or value not in (
          'venue',
          'guest_experience',
          'photography',
          'food',
          'music',
          'style',
          'accommodation',
          'accessibility',
          'sustainability',
          'value'
        )
    )
    or exists (
      select 1
      from pg_catalog.unnest(
        normalized_venue_styles || normalized_photography_styles
      ) value
      where value is null
        or pg_catalog.char_length(value) not between 1 and 80
    )
    or pg_catalog.cardinality(normalized_priorities) <> (
      select pg_catalog.count(distinct value)
      from pg_catalog.unnest(normalized_priorities) value
    )
    or pg_catalog.cardinality(normalized_venue_styles) <> (
      select pg_catalog.count(distinct value)
      from pg_catalog.unnest(normalized_venue_styles) value
    )
    or pg_catalog.cardinality(normalized_photography_styles) <> (
      select pg_catalog.count(distinct value)
      from pg_catalog.unnest(normalized_photography_styles) value
    )
  then
    raise exception 'Wedding setup contains invalid profile choices'
      using errcode = 'invalid_parameter_value';
  end if;

  select workspace.owner_id, workspace.budget_plan_id, workspace.updated_at
  into workspace_owner_id, workspace_budget_plan_id, current_workspace_version
  from public.planning_workspaces workspace
  where workspace.id = target_workspace_id
  for update;

  if not found or workspace_budget_plan_id is null then
    raise exception 'The connected workspace is unavailable'
      using errcode = 'no_data_found';
  end if;
  if current_workspace_version is distinct from expected_workspace_updated_at then
    raise exception 'The connected workspace changed after it was loaded'
      using errcode = 'P4090';
  end if;

  select plan.updated_at
  into current_budget_version
  from public.budget_plans plan
  where plan.user_id = workspace_owner_id
    and plan.id = workspace_budget_plan_id
  for update;

  if not found then
    raise exception 'The connected budget is unavailable'
      using errcode = 'no_data_found';
  end if;
  if current_budget_version is distinct from expected_budget_updated_at then
    raise exception 'The connected budget changed after it was loaded'
      using errcode = 'P4090';
  end if;

  select profile.updated_at
  into current_profile_version
  from public.planning_workspace_profiles profile
  where profile.workspace_id = target_workspace_id
  for update;

  if found then
    if current_profile_version is distinct from expected_profile_updated_at then
      raise exception 'The wedding profile changed after it was loaded'
        using errcode = 'P4090';
    end if;
  elsif expected_profile_updated_at is not null then
    raise exception 'The wedding profile changed after it was loaded'
      using errcode = 'P4090';
  end if;

  next_budget_version := greatest(
    pg_catalog.clock_timestamp(),
    current_budget_version + interval '1 microsecond'
  );

  update public.budget_plans plan
  set total_budget_pence = setup_total_budget_pence,
      plan_json = plan.plan_json || pg_catalog.jsonb_build_object(
        'totalBudgetPence', setup_total_budget_pence,
        'weddingDate', setup_wedding_date,
        'guestCount', setup_guest_count,
        'location', normalized_location,
        'updatedAt', next_budget_version
      ),
      updated_at = next_budget_version
  where plan.user_id = workspace_owner_id
    and plan.id = workspace_budget_plan_id
    and plan.updated_at = current_budget_version
  returning plan.updated_at into next_budget_version;

  if not found then
    raise exception 'The connected budget changed during setup'
      using errcode = 'P4090';
  end if;

  insert into public.planning_workspace_profiles (
    workspace_id,
    wedding_date,
    guest_count,
    location,
    date_flexibility,
    location_flexible,
    priorities,
    venue_styles,
    photography_styles,
    vision
  )
  values (
    target_workspace_id,
    setup_wedding_date,
    setup_guest_count,
    normalized_location,
    setup_date_flexibility,
    setup_location_flexible,
    normalized_priorities,
    normalized_venue_styles,
    normalized_photography_styles,
    normalized_vision
  )
  on conflict on constraint planning_workspace_profiles_pkey do update
  set wedding_date = excluded.wedding_date,
      guest_count = excluded.guest_count,
      location = excluded.location,
      date_flexibility = excluded.date_flexibility,
      location_flexible = excluded.location_flexible,
      priorities = excluded.priorities,
      venue_styles = excluded.venue_styles,
      photography_styles = excluded.photography_styles,
      vision = excluded.vision
  returning updated_at into next_profile_version;

  select workspace.updated_at
  into next_workspace_version
  from public.planning_workspaces workspace
  where workspace.id = target_workspace_id;

  return query select
    next_workspace_version,
    next_budget_version,
    next_profile_version;
end;
$$;

revoke all on function public.update_planning_workspace_setup_v1(
  uuid,
  bigint,
  date,
  integer,
  text,
  text,
  boolean,
  text[],
  text[],
  text[],
  text,
  timestamptz,
  timestamptz,
  timestamptz
) from public, anon, service_role;

grant execute on function public.update_planning_workspace_setup_v1(
  uuid,
  bigint,
  date,
  integer,
  text,
  text,
  boolean,
  text[],
  text[],
  text[],
  text,
  timestamptz,
  timestamptz,
  timestamptz
) to authenticated;

comment on function public.update_planning_workspace_setup_v1(
  uuid,
  bigint,
  date,
  integer,
  text,
  text,
  boolean,
  text[],
  text[],
  text[],
  text,
  timestamptz,
  timestamptz,
  timestamptz
) is 'Atomically updates a member-visible workspace budget and complete wedding profile with optimistic version checks.';

notify pgrst, 'reload schema';
