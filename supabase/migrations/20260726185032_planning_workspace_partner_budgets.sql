create or replace function private.can_access_planning_budget_plan(
  target_owner_id uuid,
  target_plan_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.planning_workspaces workspace
      join public.planning_workspace_members member
        on member.workspace_id = workspace.id
      where workspace.owner_id = target_owner_id
        and workspace.budget_plan_id = target_plan_id
        and member.user_id = (select auth.uid())
    );
$$;

revoke all on function private.can_access_planning_budget_plan(uuid, text) from public;
grant execute on function private.can_access_planning_budget_plan(uuid, text) to authenticated;

revoke all on table public.budget_plans from authenticated;
grant select, insert, delete on table public.budget_plans to authenticated;
grant update (
  name,
  scenario_name,
  currency,
  total_budget_pence,
  plan_json,
  updated_at
) on table public.budget_plans to authenticated;

drop policy if exists "Workspace members read linked budget plans" on public.budget_plans;
create policy "Workspace members read linked budget plans"
  on public.budget_plans
  for select
  to authenticated
  using (
    (select private.can_access_planning_budget_plan(user_id, id))
  );

drop policy if exists "Workspace members update linked budget plans" on public.budget_plans;
create policy "Workspace members update linked budget plans"
  on public.budget_plans
  for update
  to authenticated
  using (
    (select private.can_access_planning_budget_plan(user_id, id))
  )
  with check (
    (select private.can_access_planning_budget_plan(user_id, id))
  );
