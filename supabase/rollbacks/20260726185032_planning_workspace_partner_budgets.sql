drop policy if exists "Workspace members update linked budget plans" on public.budget_plans;
drop policy if exists "Workspace members read linked budget plans" on public.budget_plans;

revoke all on table public.budget_plans from authenticated;
grant select, insert, update, delete on table public.budget_plans to authenticated;

revoke all on function private.can_access_planning_budget_plan(uuid, text) from public;
drop function if exists private.can_access_planning_budget_plan(uuid, text);
