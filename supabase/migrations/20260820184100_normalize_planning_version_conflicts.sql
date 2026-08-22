-- Hosted production requests repeatedly retried intentional SQLSTATE 40001
-- conflicts until the upstream timeout. Expose the same failures through a
-- non-transient application-specific code so clients receive them promptly.

create or replace function public.import_planning_workspace_with_budget_v2(
  workspace_snapshot jsonb,
  budget_plan jsonb,
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
begin
  return query
  select imported.workspace_id, imported.workspace_updated_at
  from public.import_planning_workspace_with_budget(
    workspace_snapshot,
    budget_plan,
    target_workspace_id,
    expected_updated_at
  ) imported;
exception
  when serialization_failure then
    raise exception 'The cloud workspace changed after it was loaded'
      using errcode = 'P4090';
end;
$$;

create or replace function public.sync_planning_table_plan_v2(
  target_workspace_id uuid,
  table_plan jsonb,
  expected_updated_at timestamptz
)
returns table (workspace_updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  select synced.workspace_updated_at
  from public.sync_planning_table_plan(
    target_workspace_id,
    table_plan,
    expected_updated_at
  ) synced;
exception
  when serialization_failure then
    raise exception 'The shared workspace changed after it was loaded'
      using errcode = 'P4090';
end;
$$;

revoke all on function public.import_planning_workspace_with_budget_v2(
  jsonb,
  jsonb,
  uuid,
  timestamptz
) from public, anon, service_role;
grant execute on function public.import_planning_workspace_with_budget_v2(
  jsonb,
  jsonb,
  uuid,
  timestamptz
) to authenticated;

revoke all on function public.sync_planning_table_plan_v2(
  uuid,
  jsonb,
  timestamptz
) from public, anon, service_role;
grant execute on function public.sync_planning_table_plan_v2(
  uuid,
  jsonb,
  timestamptz
) to authenticated;

comment on function public.import_planning_workspace_with_budget_v2(
  jsonb,
  jsonb,
  uuid,
  timestamptz
) is 'Atomically imports a Planning Workspace while exposing stale versions as non-transient P4090 conflicts.';
comment on function public.sync_planning_table_plan_v2(
  uuid,
  jsonb,
  timestamptz
) is 'Synchronizes a shared table plan while exposing stale versions as non-transient P4090 conflicts.';

notify pgrst, 'reload schema';
