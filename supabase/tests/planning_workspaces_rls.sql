-- Transaction-safe RLS verification for My EverAft connected workspaces.
--
-- Preferred repository command:
--   npm run test:planning-rls
--
-- The same transaction can also run against a local Supabase database or a
-- disposable development branch after its migrations have been applied.
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
  ),
  (
    'b0000000-0000-4000-8000-00000000000b',
    'authenticated',
    'authenticated',
    'planning-invitee@example.invalid',
    'not-a-real-password',
    now(), now(), now()
  ),
  (
    'c0000000-0000-4000-8000-00000000000c',
    'authenticated',
    'authenticated',
    'planning-unconfirmed@example.invalid',
    'not-a-real-password',
    null, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, email, role)
values
  ('30000000-0000-4000-8000-000000000003', 'planning-owner@example.invalid', 'user'),
  ('40000000-0000-4000-8000-000000000004', 'planning-partner@example.invalid', 'user'),
  ('50000000-0000-4000-8000-000000000005', 'planning-outsider@example.invalid', 'user'),
  ('b0000000-0000-4000-8000-00000000000b', 'planning-invitee@example.invalid', 'user'),
  ('c0000000-0000-4000-8000-00000000000c', 'planning-unconfirmed@example.invalid', 'user')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.budget_plans (
  id,
  user_id,
  name,
  plan_json
)
values
  (
    'planning-budget-1',
    '30000000-0000-4000-8000-000000000003',
    'Planning test budget',
    '{}'::jsonb
  ),
  (
    'planning-budget-private',
    '30000000-0000-4000-8000-000000000003',
    'Owner private budget',
    '{}'::jsonb
  );

insert into public.planning_workspaces (id, owner_id, budget_plan_id, name)
values (
  '60000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000003',
  'planning-budget-1',
  'Owner wedding plan'
);

insert into public.planning_workspace_profiles (
  workspace_id,
  wedding_date,
  guest_count,
  location,
  date_flexibility,
  priorities,
  venue_styles,
  photography_styles,
  vision
)
values (
  '60000000-0000-4000-8000-000000000006',
  '2027-06-12',
  90,
  'Perthshire',
  'fixed',
  array['venue', 'guest_experience'],
  array['Castle'],
  array['Documentary'],
  'A relaxed weekend with everyone together.'
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
  'planning-invitee@example.invalid',
  encode(
    extensions.digest(
      convert_to('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'UTF8'),
      'sha256'
    ),
    'hex'
  ),
  '30000000-0000-4000-8000-000000000003',
  now() + interval '7 days'
);

insert into public.planning_workspace_invites (
  id, workspace_id, email_normalized, token_hash, invited_by, expires_at
)
values (
  'd0000000-0000-4000-8000-00000000000d',
  '60000000-0000-4000-8000-000000000006',
  'planning-unconfirmed@example.invalid',
  encode(
    extensions.digest(
      convert_to('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'UTF8'),
      'sha256'
    ),
    'hex'
  ),
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
    select count(*) from public.planning_workspace_profiles
    where workspace_id = '60000000-0000-4000-8000-000000000006'
      and guest_count = 90
  ) <> 1 then
    raise exception 'RLS failure: partner cannot read the shared wedding profile';
  end if;

  if (
    select count(*) from public.planning_workspace_invites
    where workspace_id = '60000000-0000-4000-8000-000000000006'
  ) <> 0 then
    raise exception 'RLS failure: partner can read owner invitation tokens';
  end if;

  if (
    select count(*) from public.budget_plans
    where user_id = '30000000-0000-4000-8000-000000000003'
      and id = 'planning-budget-1'
  ) <> 1 then
    raise exception 'RLS failure: partner cannot read the linked budget plan';
  end if;

  if (
    select count(*) from public.budget_plans
    where user_id = '30000000-0000-4000-8000-000000000003'
      and id = 'planning-budget-private'
  ) <> 0 then
    raise exception 'RLS failure: partner can read an unlinked owner budget plan';
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

  update public.planning_workspace_profiles
  set photography_styles = array['Editorial', 'Documentary']
  where workspace_id = '60000000-0000-4000-8000-000000000006';

  if not found then
    raise exception 'RLS failure: partner cannot update the shared wedding profile';
  end if;

  update public.budget_plans
  set name = 'Partner-updated planning budget'
  where user_id = '30000000-0000-4000-8000-000000000003'
    and id = 'planning-budget-1';

  if not found then
    raise exception 'RLS failure: partner cannot update the linked budget plan';
  end if;

  begin
    update public.budget_plans
    set user_id = '40000000-0000-4000-8000-000000000004'
    where user_id = '30000000-0000-4000-8000-000000000003'
      and id = 'planning-budget-1';
    raise exception 'Grant failure: partner changed linked budget ownership';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.budget_plans
    set id = 'partner-stolen-budget'
    where user_id = '30000000-0000-4000-8000-000000000003'
      and id = 'planning-budget-1';
    raise exception 'Grant failure: partner changed the linked budget identifier';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.planning_workspaces
    set owner_id = '40000000-0000-4000-8000-000000000004'
    where id = '60000000-0000-4000-8000-000000000006';
    raise exception 'Grant failure: partner changed workspace ownership';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.planning_workspaces
    set budget_plan_id = 'planning-budget-private'
    where id = '60000000-0000-4000-8000-000000000006';
    raise exception 'Grant failure: partner relinked the workspace to another owner budget';
  exception
    when insufficient_privilege then null;
  end;

  if (
    select budget_plan_id
    from public.planning_workspaces
    where id = '60000000-0000-4000-8000-000000000006'
  ) <> 'planning-budget-1' then
    raise exception 'RLS failure: the shared workspace budget link changed';
  end if;

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

  begin
    perform public.import_planning_workspace_snapshot_v2(
      jsonb_build_object(
        'id', '60000000-0000-4000-8000-000000000006',
        'budgetPlanId', 'planning-budget-1',
        'name', 'Injected partner snapshot',
        'profile', jsonb_build_object(
          'schemaVersion', 1,
          'weddingDate', null,
          'guestCount', 20,
          'location', 'Injected location',
          'dateFlexibility', 'not_set',
          'locationFlexible', false,
          'priorities', '[]'::jsonb,
          'venueStyles', '[]'::jsonb,
          'photographyStyles', '[]'::jsonb,
          'vision', null
        ),
        'tasks', '[]'::jsonb,
        'guests', '[]'::jsonb,
        'tables', '[]'::jsonb,
        'seats', '[]'::jsonb,
        'rules', '[]'::jsonb
      ),
      '60000000-0000-4000-8000-000000000006',
      (
        select updated_at
        from public.planning_workspaces
        where id = '60000000-0000-4000-8000-000000000006'
      )
    );
    raise exception 'Import failure: partner replaced the owner cloud snapshot';
  exception
    when insufficient_privilege then null;
  end;

  perform public.sync_planning_table_plan(
    '60000000-0000-4000-8000-000000000006',
    jsonb_build_object(
      'schemaVersion', 1,
      'id', 'shared-table-plan',
      'name', 'Shared tables',
      'guests', '[]'::jsonb,
      'tables', '[]'::jsonb,
      'rules', '[]'::jsonb,
      'updatedAt', now()
    ),
    (
      select updated_at
      from public.planning_workspaces
      where id = '60000000-0000-4000-8000-000000000006'
    )
  );

  begin
    perform public.sync_planning_table_plan(
      '60000000-0000-4000-8000-000000000006',
      jsonb_build_object(
        'schemaVersion', 1,
        'id', 'stale-table-plan',
        'name', 'Stale tables',
        'guests', '[]'::jsonb,
        'tables', '[]'::jsonb,
        'rules', '[]'::jsonb,
        'updatedAt', now()
      ),
      '2020-01-01T00:00:00Z'
    );
    raise exception 'Sync failure: stale partner table plan replaced shared data';
  exception
    when serialization_failure then null;
  end;
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

  if (
    select count(*) from public.planning_workspace_profiles
    where workspace_id = '60000000-0000-4000-8000-000000000006'
  ) <> 0 then
    raise exception 'RLS failure: outsider can read the private wedding profile';
  end if;

  if (
    select count(*) from public.budget_plans
    where user_id = '30000000-0000-4000-8000-000000000003'
      and id = 'planning-budget-1'
  ) <> 0 then
    raise exception 'RLS failure: outsider can read the linked budget plan';
  end if;

  update public.budget_plans
  set name = 'Outsider update'
  where user_id = '30000000-0000-4000-8000-000000000003'
    and id = 'planning-budget-1';
  if found then
    raise exception 'RLS failure: outsider updated the linked budget plan';
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

  begin
    perform public.accept_planning_workspace_invite(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    raise exception 'Invitation failure: a different verified email accepted the invitation';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.sync_planning_table_plan(
      '60000000-0000-4000-8000-000000000006',
      '{"guests":[],"tables":[],"rules":[]}'::jsonb,
      (
        select updated_at
        from public.planning_workspaces
        where id = '60000000-0000-4000-8000-000000000006'
      )
    );
    raise exception 'RLS failure: outsider replaced the shared table plan';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-00000000000c', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  begin
    perform public.accept_planning_workspace_invite(
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    );
    raise exception 'Invitation failure: an unconfirmed email accepted the invitation';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-00000000000b', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  accepted_workspace_id uuid;
begin
  accepted_workspace_id := public.accept_planning_workspace_invite(
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  );

  if accepted_workspace_id <> '60000000-0000-4000-8000-000000000006' then
    raise exception 'Invitation failure: acceptance returned the wrong workspace';
  end if;

  if (
    select role
    from public.planning_workspace_members
    where workspace_id = '60000000-0000-4000-8000-000000000006'
      and user_id = 'b0000000-0000-4000-8000-00000000000b'
  ) <> 'partner' then
    raise exception 'Invitation failure: accepted invite did not create partner membership';
  end if;

  if (
    select count(*)
    from public.planning_workspaces
    where id = '60000000-0000-4000-8000-000000000006'
  ) <> 1 then
    raise exception 'Invitation failure: accepted partner cannot read the workspace';
  end if;

  begin
    perform public.accept_planning_workspace_invite(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    raise exception 'Invitation failure: an invitation token was reused';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    update public.planning_workspace_invites
    set accepted_at = now()
    where id = 'a0000000-0000-4000-8000-00000000000a';
    raise exception 'Grant failure: invitee directly changed invitation acceptance state';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  previous_updated_at timestamptz;
  imported_workspace_id uuid;
begin
  select updated_at
  into previous_updated_at
  from public.planning_workspaces
  where id = '60000000-0000-4000-8000-000000000006';

  select result.workspace_id
  into imported_workspace_id
  from public.import_planning_workspace_snapshot_v2(
    jsonb_build_object(
      'id', 'e0000000-0000-4000-8000-00000000000e',
      'budgetPlanId', 'planning-budget-1',
      'name', 'Imported owner plan',
      'profile', jsonb_build_object(
        'schemaVersion', 1,
        'weddingDate', '2027-09-18',
        'guestCount', 84,
        'location', 'Fife',
        'dateFlexibility', 'few_weeks',
        'locationFlexible', true,
        'priorities', jsonb_build_array('venue', 'photography'),
        'venueStyles', jsonb_build_array('Country house'),
        'photographyStyles', jsonb_build_array('Documentary'),
        'vision', 'A warm autumn celebration.'
      ),
      'tasks', jsonb_build_array(jsonb_build_object(
        'id', 'f0000000-0000-4000-8000-00000000000f',
        'title', 'Imported task',
        'notes', null,
        'category', 'general',
        'status', 'todo',
        'dueDate', null,
        'sortOrder', 0
      )),
      'guests', jsonb_build_array(jsonb_build_object(
        'id', '81000000-0000-4000-8000-000000000008',
        'name', 'Imported guest',
        'email', 'guest@example.invalid',
        'rsvpStatus', 'accepted',
        'dietaryNotes', 'Vegetarian'
      )),
      'tables', jsonb_build_array(jsonb_build_object(
        'id', '91000000-0000-4000-8000-000000000009',
        'name', 'Imported table',
        'capacity', 8,
        'locked', false
      )),
      'seats', jsonb_build_array(jsonb_build_object(
        'guestId', '81000000-0000-4000-8000-000000000008',
        'tableId', '91000000-0000-4000-8000-000000000009',
        'seatIndex', 0
      )),
      'rules', '[]'::jsonb
    ),
    '60000000-0000-4000-8000-000000000006',
    previous_updated_at
  ) result;

  if imported_workspace_id <> '60000000-0000-4000-8000-000000000006' then
    raise exception 'Import failure: snapshot returned the wrong workspace';
  end if;

  if (
    select count(*)
    from public.planning_tasks
    where workspace_id = imported_workspace_id
      and title = 'Imported task'
  ) <> 1 then
    raise exception 'Import failure: owner snapshot tasks were not replaced atomically';
  end if;

  if (
    select count(*)
    from public.planning_guests
    where workspace_id = imported_workspace_id
      and email = 'guest@example.invalid'
      and rsvp_status = 'accepted'
      and dietary_notes = 'Vegetarian'
  ) <> 1 then
    raise exception 'Import failure: private guest details were not preserved';
  end if;

  if (
    select count(*)
    from public.planning_workspace_profiles
    where workspace_id = imported_workspace_id
      and wedding_date = '2027-09-18'
      and guest_count = 84
      and location = 'Fife'
      and date_flexibility = 'few_weeks'
      and location_flexible
      and priorities = array['venue', 'photography']
      and venue_styles = array['Country house']
      and photography_styles = array['Documentary']
      and vision = 'A warm autumn celebration.'
  ) <> 1 then
    raise exception 'Import failure: wedding profile was not replaced atomically';
  end if;

  begin
    perform public.import_planning_workspace_snapshot_v2(
      jsonb_build_object(
        'id', 'e0000000-0000-4000-8000-00000000000e',
        'budgetPlanId', 'planning-budget-1',
        'name', 'Stale overwrite attempt',
        'profile', jsonb_build_object(
          'schemaVersion', 1,
          'weddingDate', null,
          'guestCount', null,
          'location', null,
          'dateFlexibility', 'not_set',
          'locationFlexible', false,
          'priorities', '[]'::jsonb,
          'venueStyles', '[]'::jsonb,
          'photographyStyles', '[]'::jsonb,
          'vision', null
        ),
        'tasks', '[]'::jsonb,
        'guests', '[]'::jsonb,
        'tables', '[]'::jsonb,
        'seats', '[]'::jsonb,
        'rules', '[]'::jsonb
      ),
      imported_workspace_id,
      previous_updated_at
    );
    raise exception 'Import failure: stale snapshot overwrote newer cloud data';
  exception
    when serialization_failure then null;
  end;

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
    perform public.sync_planning_table_plan(
      '60000000-0000-4000-8000-000000000006',
      '{"guests":[],"tables":[],"rules":[]}'::jsonb,
      now()
    );
    raise exception 'Grant failure: anonymous role called table-plan sync';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.budget_plans limit 1;
    raise exception 'Grant failure: anonymous role can read linked budget plans';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.planning_guests limit 1;
    raise exception 'Grant failure: anonymous role can read private guest data';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.planning_workspace_profiles limit 1;
    raise exception 'Grant failure: anonymous role can read private wedding profiles';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.accept_planning_workspace_invite(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    raise exception 'Grant failure: anonymous role called invitation acceptance';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.import_planning_workspace_snapshot_v2(
      '{}'::jsonb,
      null,
      null
    );
    raise exception 'Grant failure: anonymous role called snapshot import';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
rollback;
