revoke all on function public.sync_planning_table_plan(
  uuid,
  jsonb,
  timestamptz
) from public, anon, authenticated, service_role;
drop function if exists public.sync_planning_table_plan(uuid, jsonb, timestamptz);
