create or replace function public.sync_planning_table_plan(
  target_workspace_id uuid,
  table_plan jsonb,
  expected_updated_at timestamptz
)
returns table (workspace_updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_updated_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to sync a table plan'
      using errcode = 'insufficient_privilege';
  end if;

  if target_workspace_id is null
    or table_plan is null
    or jsonb_typeof(table_plan) <> 'object'
    or jsonb_typeof(table_plan->'guests') <> 'array'
    or jsonb_typeof(table_plan->'tables') <> 'array'
    or jsonb_typeof(table_plan->'rules') <> 'array'
  then
    raise exception 'A valid table plan is required'
      using errcode = 'invalid_parameter_value';
  end if;

  if pg_catalog.pg_column_size(table_plan) > 1000000
    or jsonb_array_length(table_plan->'guests') > 1000
    or jsonb_array_length(table_plan->'tables') > 200
    or jsonb_array_length(table_plan->'rules') > 2000
  then
    raise exception 'The table plan is too large'
      using errcode = 'program_limit_exceeded';
  end if;

  select workspace.updated_at
  into current_updated_at
  from public.planning_workspaces workspace
  where workspace.id = target_workspace_id
    and (select private.can_access_planning_workspace(workspace.id))
  for update;

  if not found then
    raise exception 'The shared workspace is unavailable'
      using errcode = 'insufficient_privilege';
  end if;

  if expected_updated_at is null
    or current_updated_at is distinct from expected_updated_at
  then
    raise exception 'The shared workspace changed after it was loaded'
      using errcode = 'serialization_failure';
  end if;

  delete from public.planning_seats
  where workspace_id = target_workspace_id;
  delete from public.planning_seating_rules
  where workspace_id = target_workspace_id;
  delete from public.planning_guests
  where workspace_id = target_workspace_id;
  delete from public.planning_tables
  where workspace_id = target_workspace_id;

  insert into public.planning_tables (
    id,
    workspace_id,
    name,
    capacity,
    locked,
    sort_order
  )
  select
    (entry.item->>'id')::uuid,
    target_workspace_id,
    btrim(entry.item->>'name'),
    (entry.item->>'capacity')::integer,
    (entry.item->>'locked')::boolean,
    (entry.ordinality - 1)::integer
  from jsonb_array_elements(table_plan->'tables')
    with ordinality entry(item, ordinality);

  insert into public.planning_guests (
    id,
    workspace_id,
    name,
    email,
    rsvp_status,
    dietary_notes,
    sort_order
  )
  select
    (entry.item->>'id')::uuid,
    target_workspace_id,
    btrim(entry.item->>'name'),
    nullif(lower(btrim(entry.item->>'email')), ''),
    coalesce(nullif(entry.item->>'rsvpStatus', ''), 'pending'),
    nullif(btrim(entry.item->>'dietaryNotes'), ''),
    (entry.ordinality - 1)::integer
  from jsonb_array_elements(table_plan->'guests')
    with ordinality entry(item, ordinality);

  if exists (
    select 1
    from jsonb_array_elements(table_plan->'guests') entry(item)
    join public.planning_tables planning_table
      on planning_table.workspace_id = target_workspace_id
      and planning_table.id = (entry.item->>'tableId')::uuid
    where nullif(entry.item->>'tableId', '') is not null
      and (
        (entry.item->>'seatIndex')::integer < 0
        or (entry.item->>'seatIndex')::integer >= planning_table.capacity
      )
  ) then
    raise exception 'A seat is outside its table capacity'
      using errcode = 'check_violation';
  end if;

  insert into public.planning_seats (
    workspace_id,
    guest_id,
    table_id,
    seat_index
  )
  select
    target_workspace_id,
    (entry.item->>'id')::uuid,
    (entry.item->>'tableId')::uuid,
    (entry.item->>'seatIndex')::integer
  from jsonb_array_elements(table_plan->'guests') entry(item)
  where nullif(entry.item->>'tableId', '') is not null
    and nullif(entry.item->>'seatIndex', '') is not null;

  insert into public.planning_seating_rules (
    id,
    workspace_id,
    person_a_id,
    person_b_id,
    rule_type
  )
  select
    (entry.item->>'id')::uuid,
    target_workspace_id,
    (entry.item->>'personAId')::uuid,
    (entry.item->>'personBId')::uuid,
    entry.item->>'type'
  from jsonb_array_elements(table_plan->'rules') entry(item);

  update public.planning_workspaces
  set updated_at = pg_catalog.clock_timestamp()
  where id = target_workspace_id
  returning updated_at into current_updated_at;

  return query select current_updated_at;
end;
$$;

revoke all on function public.sync_planning_table_plan(
  uuid,
  jsonb,
  timestamptz
) from public, anon, service_role;
grant execute on function public.sync_planning_table_plan(
  uuid,
  jsonb,
  timestamptz
) to authenticated;
