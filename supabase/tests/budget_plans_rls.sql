-- Transaction-safe RLS verification for the Planning Hub budget plan.
--
-- Run only against a local Supabase database or disposable development branch:
--   supabase test db supabase/tests/budget_plans_rls.sql
--
-- The transaction always rolls back its synthetic users and plans.

begin;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'planning-hub-owner-a@example.invalid',
    'not-a-real-password',
    now(),
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'planning-hub-user-b@example.invalid',
    'not-a-real-password',
    now(),
    now(),
    now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, email, role)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'planning-hub-owner-a@example.invalid',
    'user'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'planning-hub-user-b@example.invalid',
    'user'
  )
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.budget_plans (
  user_id,
  id,
  name,
  scenario_name,
  currency,
  total_budget_pence,
  plan_json
)
values (
  '10000000-0000-4000-8000-000000000001',
  'owner-a-plan',
  'Owner A wedding budget',
  'Current plan',
  'GBP',
  2000000,
  '{"version":1}'::jsonb
);

do $$
begin
  if (
    select count(*)
    from public.budget_plans
    where id = 'owner-a-plan'
  ) <> 1 then
    raise exception 'RLS failure: owner A cannot read their own plan';
  end if;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if (
    select count(*)
    from public.budget_plans
    where id = 'owner-a-plan'
  ) <> 0 then
    raise exception 'RLS failure: unrelated user B can read owner A plan';
  end if;

  update public.budget_plans
  set name = 'Changed by user B'
  where id = 'owner-a-plan';
  if found then
    raise exception 'RLS failure: unrelated user B can update owner A plan';
  end if;

  delete from public.budget_plans
  where id = 'owner-a-plan';
  if found then
    raise exception 'RLS failure: unrelated user B can delete owner A plan';
  end if;

  begin
    insert into public.budget_plans (
      user_id,
      id,
      name,
      scenario_name,
      currency,
      total_budget_pence,
      plan_json
    )
    values (
      '10000000-0000-4000-8000-000000000001',
      'cross-owner-plan',
      'Attempted cross-owner plan',
      'Current plan',
      'GBP',
      1000000,
      '{"version":1}'::jsonb
    );
    raise exception 'RLS failure: user B inserted a plan owned by user A';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

insert into public.budget_plans (
  user_id,
  id,
  name,
  scenario_name,
  currency,
  total_budget_pence,
  plan_json
)
values (
  '20000000-0000-4000-8000-000000000002',
  'user-b-plan',
  'User B wedding budget',
  'Current plan',
  'GBP',
  1500000,
  '{"version":1}'::jsonb
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  begin
    update public.budget_plans
    set user_id = '20000000-0000-4000-8000-000000000002'
    where id = 'owner-a-plan';
    raise exception 'RLS failure: owner A transferred a plan to user B';
  exception
    when insufficient_privilege then null;
  end;

  delete from public.budget_plans
  where id = 'owner-a-plan';
  if not found then
    raise exception 'RLS failure: owner A cannot delete their own plan';
  end if;
end
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

do $$
begin
  begin
    perform 1 from public.budget_plans limit 1;
    raise exception 'Grant failure: anonymous role can read budget plans';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.budget_plans (
      user_id,
      id,
      name,
      scenario_name,
      currency,
      total_budget_pence,
      plan_json
    )
    values (
      '10000000-0000-4000-8000-000000000001',
      'anonymous-plan',
      'Anonymous plan',
      'Current plan',
      'GBP',
      1000000,
      '{"version":1}'::jsonb
    );
    raise exception 'Grant failure: anonymous role can insert budget plans';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
rollback;
