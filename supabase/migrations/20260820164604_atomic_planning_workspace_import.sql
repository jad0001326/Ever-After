create or replace function public.import_planning_workspace_with_budget(
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
declare
  current_user_id uuid := (select auth.uid());
  plan_id text;
  plan_name text;
  plan_scenario_name text;
  plan_currency text;
  plan_total_budget_pence bigint;
  plan_updated_at timestamptz;
  normalized_budget_plan jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to import a planning workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if budget_plan is null or jsonb_typeof(budget_plan) <> 'object' then
    raise exception 'A budget plan object is required'
      using errcode = 'invalid_parameter_value';
  end if;

  if pg_catalog.pg_column_size(budget_plan) > 1000000 then
    raise exception 'The budget plan is too large'
      using errcode = 'program_limit_exceeded';
  end if;

  if (budget_plan->>'schemaVersion')::integer <> 1
    or jsonb_typeof(budget_plan->'categories') <> 'array'
    or jsonb_typeof(budget_plan->'items') <> 'array'
  then
    raise exception 'A complete versioned budget plan is required'
      using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_array_length(budget_plan->'categories') > 100
    or jsonb_array_length(budget_plan->'items') > 500
  then
    raise exception 'The budget plan is too large'
      using errcode = 'program_limit_exceeded';
  end if;

  plan_id := nullif(btrim(budget_plan->>'id'), '');
  plan_name := nullif(btrim(budget_plan->>'name'), '');
  plan_scenario_name := budget_plan->>'scenarioName';
  plan_currency := budget_plan->>'currency';
  plan_total_budget_pence := (budget_plan->>'totalBudgetPence')::bigint;
  plan_updated_at := (budget_plan->>'updatedAt')::timestamptz;

  if plan_id is null
    or char_length(plan_id) > 100
    or plan_name is null
    or char_length(plan_name) > 120
    or plan_scenario_name is null
    or char_length(plan_scenario_name) > 80
    or plan_currency not in ('GBP', 'EUR', 'USD')
    or plan_total_budget_pence not between 0 and 1000000000
    or plan_updated_at is null
  then
    raise exception 'The budget plan identity or totals are invalid'
      using errcode = 'invalid_parameter_value';
  end if;

  if nullif(btrim(workspace_snapshot->>'budgetPlanId'), '') is distinct from plan_id then
    raise exception 'The workspace and budget plan do not match'
      using errcode = 'invalid_parameter_value';
  end if;

  normalized_budget_plan := jsonb_set(
    budget_plan,
    '{userId}',
    to_jsonb(current_user_id),
    true
  );

  insert into public.budget_plans (
    id,
    user_id,
    name,
    scenario_name,
    currency,
    total_budget_pence,
    plan_json,
    updated_at
  )
  values (
    plan_id,
    current_user_id,
    plan_name,
    plan_scenario_name,
    plan_currency,
    plan_total_budget_pence,
    normalized_budget_plan,
    plan_updated_at
  )
  on conflict on constraint budget_plans_pkey do update
  set name = excluded.name,
      scenario_name = excluded.scenario_name,
      currency = excluded.currency,
      total_budget_pence = excluded.total_budget_pence,
      plan_json = excluded.plan_json,
      updated_at = excluded.updated_at;

  return query
  select imported.workspace_id, imported.workspace_updated_at
  from public.import_planning_workspace_snapshot_v2(
    workspace_snapshot,
    target_workspace_id,
    expected_updated_at
  ) imported;
end;
$$;

revoke all on function public.import_planning_workspace_with_budget(
  jsonb,
  jsonb,
  uuid,
  timestamptz
) from public, anon, service_role;

grant execute on function public.import_planning_workspace_with_budget(
  jsonb,
  jsonb,
  uuid,
  timestamptz
) to authenticated;

comment on function public.import_planning_workspace_with_budget(
  jsonb,
  jsonb,
  uuid,
  timestamptz
) is 'Atomically saves an authenticated owner budget and imports the matching Planning Workspace snapshot.';

notify pgrst, 'reload schema';
