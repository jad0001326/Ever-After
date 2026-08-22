revoke all on function public.import_planning_workspace_with_budget_v2(
  jsonb,
  jsonb,
  uuid,
  timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.sync_planning_table_plan_v2(
  uuid,
  jsonb,
  timestamptz
) from public, anon, authenticated, service_role;

drop function if exists public.import_planning_workspace_with_budget_v2(
  jsonb,
  jsonb,
  uuid,
  timestamptz
);
drop function if exists public.sync_planning_table_plan_v2(
  uuid,
  jsonb,
  timestamptz
);

notify pgrst, 'reload schema';
