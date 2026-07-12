-- Wedding Budget Planner: private, account-owned plan storage.
create table if not exists public.budget_plans (
  id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  scenario_name text not null default 'Current plan' check (char_length(scenario_name) between 1 and 80),
  currency text not null default 'GBP' check (currency in ('GBP', 'EUR', 'USD')),
  total_budget_pence integer not null default 0 check (total_budget_pence between 0 and 1000000000),
  plan_json jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists budget_plans_user_updated_idx on public.budget_plans (user_id, updated_at desc);
drop trigger if exists budget_plans_set_updated_at on public.budget_plans;
create trigger budget_plans_set_updated_at before update on public.budget_plans for each row execute function public.set_updated_at();
alter table public.budget_plans enable row level security;
grant select, insert, update, delete on public.budget_plans to authenticated;
drop policy if exists "Users manage own budget plans" on public.budget_plans;
create policy "Users manage own budget plans" on public.budget_plans for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
notify pgrst, 'reload schema';

