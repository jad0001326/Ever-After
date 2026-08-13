create table if not exists public.budget_plans (
  id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  scenario_name text not null default 'Current plan',
  currency text not null default 'GBP',
  total_budget_pence bigint not null default 0,
  plan_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_plans_id_length check (char_length(id) between 1 and 100),
  constraint budget_plans_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint budget_plans_scenario_name_length check (char_length(scenario_name) between 0 and 80),
  constraint budget_plans_currency check (currency in ('GBP', 'EUR', 'USD')),
  constraint budget_plans_total_budget check (total_budget_pence between 0 and 1000000000),
  constraint budget_plans_plan_json_object check (jsonb_typeof(plan_json) = 'object'),
  constraint budget_plans_pkey primary key (user_id, id)
);

create index if not exists budget_plans_user_updated_idx
  on public.budget_plans (user_id, updated_at desc);

alter table public.budget_plans enable row level security;

revoke all on table public.budget_plans from anon;
revoke all on table public.budget_plans from authenticated;
grant select, insert, update, delete on table public.budget_plans to authenticated;
grant all on table public.budget_plans to service_role;

drop policy if exists "Users read their own budget plans" on public.budget_plans;
create policy "Users read their own budget plans"
  on public.budget_plans
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users create their own budget plans" on public.budget_plans;
create policy "Users create their own budget plans"
  on public.budget_plans
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users update their own budget plans" on public.budget_plans;
create policy "Users update their own budget plans"
  on public.budget_plans
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users delete their own budget plans" on public.budget_plans;
create policy "Users delete their own budget plans"
  on public.budget_plans
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
