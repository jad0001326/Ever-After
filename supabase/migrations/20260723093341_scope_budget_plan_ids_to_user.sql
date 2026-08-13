alter table public.budget_plans
  drop constraint if exists budget_plans_pkey;

alter table public.budget_plans
  add constraint budget_plans_pkey primary key (user_id, id);
