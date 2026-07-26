-- Adds an explicit, transaction-safe device snapshot import for My EverAft.
-- This migration is intentionally dormant until PLANNING_WORKSPACE_CLOUD_ENABLED
-- is enabled after local RLS verification. The import function runs as the
-- signed-in caller, so the existing grants and RLS policies remain authoritative.

create or replace function private.touch_planning_workspace_from_child()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected_workspace_id uuid;
begin
  -- Skip child cascades caused by deleting a parent workspace or table. The
  -- outer delete already owns the parent lifecycle and must not be interrupted
  -- by an updated_at write against the row being deleted.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  affected_workspace_id := case
    when tg_op = 'DELETE' then old.workspace_id
    else new.workspace_id
  end;

  update public.planning_workspaces
  set updated_at = pg_catalog.clock_timestamp()
  where id = affected_workspace_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.touch_planning_workspace_from_child() from public;

create trigger planning_tasks_touch_workspace
after insert or update or delete on public.planning_tasks
for each row execute function private.touch_planning_workspace_from_child();

create trigger planning_guests_touch_workspace
after insert or update or delete on public.planning_guests
for each row execute function private.touch_planning_workspace_from_child();

create trigger planning_tables_touch_workspace
after insert or update or delete on public.planning_tables
for each row execute function private.touch_planning_workspace_from_child();

create trigger planning_seats_touch_workspace
after insert or update or delete on public.planning_seats
for each row execute function private.touch_planning_workspace_from_child();

create trigger planning_seating_rules_touch_workspace
after insert or update or delete on public.planning_seating_rules
for each row execute function private.touch_planning_workspace_from_child();

-- Bring existing workspaces up to the newest timestamp in their child records so
-- the first optimistic-concurrency token is reliable.
update public.planning_workspaces workspace
set updated_at = greatest(
  workspace.updated_at,
  coalesce((
    select max(task.updated_at)
    from public.planning_tasks task
    where task.workspace_id = workspace.id
  ), '-infinity'::timestamptz),
  coalesce((
    select max(guest.updated_at)
    from public.planning_guests guest
    where guest.workspace_id = workspace.id
  ), '-infinity'::timestamptz),
  coalesce((
    select max(planning_table.updated_at)
    from public.planning_tables planning_table
    where planning_table.workspace_id = workspace.id
  ), '-infinity'::timestamptz),
  coalesce((
    select max(seat.updated_at)
    from public.planning_seats seat
    where seat.workspace_id = workspace.id
  ), '-infinity'::timestamptz),
  coalesce((
    select max(rule.created_at)
    from public.planning_seating_rules rule
    where rule.workspace_id = workspace.id
  ), '-infinity'::timestamptz)
);

create or replace function public.import_planning_workspace_snapshot(
  workspace_snapshot jsonb,
  target_workspace_id uuid default null,
  expected_updated_at timestamptz default null
)
returns table (
  workspace_id uuid,
  workspace_updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  requested_workspace_id uuid;
  resolved_workspace_id uuid;
  snapshot_budget_plan_id text;
  snapshot_name text;
  current_updated_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to import a planning workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if workspace_snapshot is null or jsonb_typeof(workspace_snapshot) <> 'object' then
    raise exception 'A planning workspace snapshot object is required'
      using errcode = 'invalid_parameter_value';
  end if;

  if pg_catalog.pg_column_size(workspace_snapshot) > 1000000 then
    raise exception 'The planning workspace snapshot is too large'
      using errcode = 'program_limit_exceeded';
  end if;

  if jsonb_typeof(workspace_snapshot->'tasks') <> 'array'
    or jsonb_typeof(workspace_snapshot->'guests') <> 'array'
    or jsonb_typeof(workspace_snapshot->'tables') <> 'array'
    or jsonb_typeof(workspace_snapshot->'seats') <> 'array'
    or jsonb_typeof(workspace_snapshot->'rules') <> 'array'
  then
    raise exception 'The planning workspace snapshot contains invalid collections'
      using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_array_length(workspace_snapshot->'tasks') > 500
    or jsonb_array_length(workspace_snapshot->'guests') > 1000
    or jsonb_array_length(workspace_snapshot->'tables') > 200
    or jsonb_array_length(workspace_snapshot->'seats') > 1000
    or jsonb_array_length(workspace_snapshot->'rules') > 2000
  then
    raise exception 'The planning workspace snapshot is too large'
      using errcode = 'program_limit_exceeded';
  end if;

  requested_workspace_id := (workspace_snapshot->>'id')::uuid;
  snapshot_budget_plan_id := nullif(btrim(workspace_snapshot->>'budgetPlanId'), '');
  snapshot_name := nullif(btrim(workspace_snapshot->>'name'), '');

  if requested_workspace_id is null
    or snapshot_budget_plan_id is null
    or snapshot_name is null
  then
    raise exception 'The planning workspace identity is incomplete'
      using errcode = 'invalid_parameter_value';
  end if;

  if target_workspace_id is null then
    if expected_updated_at is not null then
      raise exception 'A new cloud workspace cannot have a previous version'
        using errcode = 'invalid_parameter_value';
    end if;

    insert into public.planning_workspaces (
      id,
      owner_id,
      budget_plan_id,
      name
    )
    values (
      requested_workspace_id,
      current_user_id,
      snapshot_budget_plan_id,
      snapshot_name
    )
    returning id into resolved_workspace_id;
  else
    select workspace.updated_at
    into current_updated_at
    from public.planning_workspaces workspace
    where workspace.id = target_workspace_id
      and workspace.owner_id = current_user_id
    for update;

    if not found then
      raise exception 'Only the workspace owner can replace this cloud plan'
        using errcode = 'insufficient_privilege';
    end if;

    if expected_updated_at is null
      or current_updated_at is distinct from expected_updated_at
    then
      raise exception 'The cloud workspace changed after it was loaded'
        using errcode = 'serialization_failure';
    end if;

    resolved_workspace_id := target_workspace_id;

    update public.planning_workspaces
    set name = snapshot_name,
        budget_plan_id = snapshot_budget_plan_id
    where id = resolved_workspace_id;
  end if;

  delete from public.planning_seats
  where planning_seats.workspace_id = resolved_workspace_id;

  delete from public.planning_seating_rules
  where planning_seating_rules.workspace_id = resolved_workspace_id;

  delete from public.planning_tasks
  where planning_tasks.workspace_id = resolved_workspace_id;

  delete from public.planning_guests
  where planning_guests.workspace_id = resolved_workspace_id;

  delete from public.planning_tables
  where planning_tables.workspace_id = resolved_workspace_id;

  insert into public.planning_tasks (
    id,
    workspace_id,
    title,
    notes,
    category,
    status,
    due_date,
    sort_order
  )
  select
    (entry.item->>'id')::uuid,
    resolved_workspace_id,
    btrim(entry.item->>'title'),
    nullif(btrim(entry.item->>'notes'), ''),
    entry.item->>'category',
    entry.item->>'status',
    (entry.item->>'dueDate')::date,
    (entry.item->>'sortOrder')::integer
  from jsonb_array_elements(workspace_snapshot->'tasks') entry(item);

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
    resolved_workspace_id,
    btrim(entry.item->>'name'),
    (entry.item->>'capacity')::integer,
    (entry.item->>'locked')::boolean,
    (entry.ordinality - 1)::integer
  from jsonb_array_elements(workspace_snapshot->'tables')
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
    resolved_workspace_id,
    btrim(entry.item->>'name'),
    nullif(lower(btrim(entry.item->>'email')), ''),
    coalesce(nullif(entry.item->>'rsvpStatus', ''), 'pending'),
    nullif(btrim(entry.item->>'dietaryNotes'), ''),
    (entry.ordinality - 1)::integer
  from jsonb_array_elements(workspace_snapshot->'guests')
    with ordinality entry(item, ordinality);

  if exists (
    select 1
    from jsonb_array_elements(workspace_snapshot->'seats') entry(item)
    join public.planning_tables planning_table
      on planning_table.workspace_id = resolved_workspace_id
      and planning_table.id = (entry.item->>'tableId')::uuid
    where (entry.item->>'seatIndex')::integer < 0
      or (entry.item->>'seatIndex')::integer >= planning_table.capacity
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
    resolved_workspace_id,
    (entry.item->>'guestId')::uuid,
    (entry.item->>'tableId')::uuid,
    (entry.item->>'seatIndex')::integer
  from jsonb_array_elements(workspace_snapshot->'seats') entry(item);

  insert into public.planning_seating_rules (
    id,
    workspace_id,
    person_a_id,
    person_b_id,
    rule_type
  )
  select
    (entry.item->>'id')::uuid,
    resolved_workspace_id,
    (entry.item->>'personAId')::uuid,
    (entry.item->>'personBId')::uuid,
    entry.item->>'type'
  from jsonb_array_elements(workspace_snapshot->'rules') entry(item);

  update public.planning_workspaces
  set updated_at = pg_catalog.clock_timestamp()
  where id = resolved_workspace_id;

  return query
  select workspace.id, workspace.updated_at
  from public.planning_workspaces workspace
  where workspace.id = resolved_workspace_id;
end;
$$;

revoke all on function public.import_planning_workspace_snapshot(
  jsonb,
  uuid,
  timestamptz
) from public, anon, service_role;

grant execute on function public.import_planning_workspace_snapshot(
  jsonb,
  uuid,
  timestamptz
) to authenticated;
