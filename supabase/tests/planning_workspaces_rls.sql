-- Transaction-safe RLS verification for My EverAft connected workspaces.
--
-- Run only against a local Supabase database or disposable development branch:
--   supabase test db supabase/tests/planning_workspaces_rls.sql
--
-- This verifies owner isolation, partner collaboration, privilege boundaries and
-- anonymous denial. The transaction always rolls back its synthetic records.

begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values
  (
    '30000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'planning-owner@example.invalid',
    'not-a-real-password',
    now(), now(), now()
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'planning-partner@example.invalid',
    'not-a-real-password',
    now(), now(), now()
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'planning-outsider@example.invalid',
    'not-a-real-password',
    now(), now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, email, role)
values
  ('30000000-0000-4000-8000-000000000003', 'planning-owner@example.invalid', 'user'),
  ('40000000-0000-4000-8000-000000000004', 'planning-partner@example.invalid', 'user'),
  ('50000000-0000-4000-8000-000000000005', 'planning-outsider@example.invalid', 'user')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.planning_workspaces (id, owner_id, name)
values (
  '60000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000003',
  'Owner wedding plan'
);

do $$
begin
  if (
    select role
    from public.planning_workspace_members
    where workspace_id = '60000000-0000-4000-8000-000000000006'
      and user_id = '30000000-0000-4000-8000-000000000003'
  ) <> 'owner' then
    raise exception 'Membership failure: workspace owner row was not created';
  end if;
end
$$;

insert into public.planning_workspace_members (workspace_id, user_id, role)
values (
  '60000000-0000-4000-8000-000000000006',
  '40000000-0000-4000-8000-000000000004',
  'partner'
);

insert into public.planning_tasks (id, workspace_id, title)
values (
  '70000000-0000-4000-8000-000000000007',
  '60000000-0000-4000-8000-000000000006',
  'Confirm the final guest count'
);

insert into public.planning_guests (id, workspace_id, name)
values (
  '80000000-0000-4000-8000-000000000008',
  '60000000-0000-4000-8000-000000000006',
  'Ailsa Grant'
);

insert into public.planning_tables (id, workspace_id, name, capacity)
values (
  '90000000-0000-4000-8000-000000000009',
  '60000000-0000-4000-8000-000000000006',
  'Top table',
  8
);

insert into public.planning_seats (workspace_id, guest_id, table_id, seat_index)
values (
  '60000000-0000-4000-8000-000000000006',
  '80000000-0000-4000-8000-000000000008',
  '90000000-0000-4000-8000-000000000009',
  0
);

insert into public.planning_workspace_invites (
  id, workspace_id, email_normalized, token_hash, invited_by, expires_at
)
values (
  'a0000000-0000-4000-8000-00000000000a',
  '60000000-0000-4000-8000-000000000006',
  'future-partner@example.invalid',
  repeat('a', 64),
  '30000000-0000-4000-8000-000000000003',
  now() + interval '7 days'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if (
    select count(*) from public.planning_workspaces
    where id = '60000000-0000-4000-8000-000000000006'
  ) <> 1 then
    raise exception 'RLS failure: partner cannot read the shared workspace';
  end if;

  if (
    select count(*) from public.planning_tasks
    where workspace_id = '60000000-0000-4000-8000-000000000006'
  ) <> 1 then
    raise exception 'RLS failure: partner cannot read shared tasks';
  end if;

  if (
    select count(*) from public.planning_workspace_invites
    where workspace_id = '60000000-0000-4000-8000-000000000006'
  ) <> 0 then
    raise exception 'RLS failure: partner can read owner invitation tokens';
  end if;
end
$$;

do $$
begin
  update public.planning_tasks
  set status = 'done'
  where id = '70000000-0000-4000-8000-000000000007';

  if not found then
    raise exception 'RLS failure: partner cannot update shared tasks';
  end if;

  begin
    update public.planning_workspaces
    set owner_id = '40000000-0000-4000-8000-000000000004'
    where id = '60000000-0000-4000-8000-000000000006';
    raise exception 'Grant failure: partner changed workspace ownership';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.planning_workspace_members (workspace_id, user_id, role)
    values (
      '60000000-0000-4000-8000-000000000006',
      '50000000-0000-4000-8000-000000000005',
      'partner'
    );
    raise exception 'RLS failure: partner added another member';
  exception
    when insufficient_privilege then null;
    when check_violation then null;
  end;

  delete from public.planning_workspaces
  where id = '60000000-0000-4000-8000-000000000006';
  if found then
    raise exception 'RLS failure: partner deleted the workspace';
  end if;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if (
    select count(*) from public.planning_workspaces
    where id = '60000000-0000-4000-8000-000000000006'
  ) <> 0 then
    raise exception 'RLS failure: outsider can read the workspace';
  end if;

  if (
    select count(*) from public.planning_guests
    where workspace_id = '60000000-0000-4000-8000-000000000006'
  ) <> 0 then
    raise exception 'RLS failure: outsider can read private guest data';
  end if;

  begin
    insert into public.planning_tasks (workspace_id, title)
    values (
      '60000000-0000-4000-8000-000000000006',
      'Injected outsider task'
    );
    raise exception 'RLS failure: outsider inserted a task';
  exception
    when insufficient_privilege then null;
    when check_violation then null;
  end;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  begin
    update public.planning_workspace_members
    set role = 'partner'
    where workspace_id = '60000000-0000-4000-8000-000000000006'
      and user_id = '30000000-0000-4000-8000-000000000003';
    raise exception 'Integrity failure: owner membership was demoted';
  exception
    when check_violation then null;
  end;

  begin
    update public.planning_workspace_members
    set role = 'owner'
    where workspace_id = '60000000-0000-4000-8000-000000000006'
      and user_id = '40000000-0000-4000-8000-000000000004';
    raise exception 'Integrity failure: partner was promoted to owner';
  exception
    when check_violation then null;
  end;
end
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

do $$
begin
  begin
    perform 1 from public.planning_workspaces limit 1;
    raise exception 'Grant failure: anonymous role can read planning workspaces';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.planning_guests limit 1;
    raise exception 'Grant failure: anonymous role can read private guest data';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
rollback;
