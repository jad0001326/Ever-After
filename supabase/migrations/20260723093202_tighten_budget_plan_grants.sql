revoke all on table public.budget_plans from anon;
revoke all on table public.budget_plans from authenticated;
grant select, insert, update, delete on table public.budget_plans to authenticated;
grant all on table public.budget_plans to service_role;
