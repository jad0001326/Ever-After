create table public.planning_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Our wedding plan',
  budget_plan_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_workspaces_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint planning_workspaces_budget_plan_length check (budget_plan_id is null or char_length(budget_plan_id) between 1 and 100),
  constraint planning_workspaces_budget_plan_fkey
    foreign key (owner_id, budget_plan_id)
    references public.budget_plans(user_id, id)
    on delete set null (budget_plan_id)
);

create table public.planning_workspace_members (
  workspace_id uuid not null references public.planning_workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint planning_workspace_members_pkey primary key (workspace_id, user_id),
  constraint planning_workspace_members_role check (role in ('owner', 'partner'))
);

create table public.planning_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.planning_workspaces(id) on delete cascade,
  title text not null,
  notes text,
  category text not null default 'general',
  status text not null default 'todo',
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_tasks_title_length check (char_length(btrim(title)) between 1 and 240),
  constraint planning_tasks_notes_length check (notes is null or char_length(notes) <= 5000),
  constraint planning_tasks_category check (category in ('venue', 'photography', 'budget', 'guests', 'tables', 'general')),
  constraint planning_tasks_status check (status in ('todo', 'in_progress', 'done')),
  constraint planning_tasks_sort_order check (sort_order between 0 and 100000)
);

create table public.planning_guests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.planning_workspaces(id) on delete cascade,
  name text not null,
  email text,
  rsvp_status text not null default 'pending',
  dietary_notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_guests_workspace_id_id_unique unique (workspace_id, id),
  constraint planning_guests_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint planning_guests_email_length check (email is null or char_length(email) <= 320),
  constraint planning_guests_rsvp_status check (rsvp_status in ('pending', 'accepted', 'declined')),
  constraint planning_guests_dietary_notes_length check (dietary_notes is null or char_length(dietary_notes) <= 2000),
  constraint planning_guests_sort_order check (sort_order between 0 and 100000)
);

create table public.planning_tables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.planning_workspaces(id) on delete cascade,
  name text not null,
  capacity integer not null default 8,
  locked boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_tables_workspace_id_id_unique unique (workspace_id, id),
  constraint planning_tables_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint planning_tables_capacity check (capacity between 2 and 20),
  constraint planning_tables_sort_order check (sort_order between 0 and 100000)
);

create table public.planning_seats (
  workspace_id uuid not null references public.planning_workspaces(id) on delete cascade,
  guest_id uuid not null,
  table_id uuid not null,
  seat_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_seats_pkey primary key (workspace_id, guest_id),
  constraint planning_seats_table_seat_unique unique (workspace_id, table_id, seat_index),
  constraint planning_seats_guest_fkey
    foreign key (workspace_id, guest_id)
    references public.planning_guests(workspace_id, id)
    on delete cascade,
  constraint planning_seats_table_fkey
    foreign key (workspace_id, table_id)
    references public.planning_tables(workspace_id, id)
    on delete cascade,
  constraint planning_seats_index check (seat_index between 0 and 19)
);

create table public.planning_seating_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.planning_workspaces(id) on delete cascade,
  person_a_id uuid not null,
  person_b_id uuid not null,
  rule_type text not null,
  created_at timestamptz not null default now(),
  constraint planning_seating_rules_person_a_fkey
    foreign key (workspace_id, person_a_id)
    references public.planning_guests(workspace_id, id)
    on delete cascade,
  constraint planning_seating_rules_person_b_fkey
    foreign key (workspace_id, person_b_id)
    references public.planning_guests(workspace_id, id)
    on delete cascade,
  constraint planning_seating_rules_people_differ check (person_a_id <> person_b_id),
  constraint planning_seating_rules_type check (rule_type in ('must_next_to', 'prefer_next_to', 'must_not_next_to', 'must_separate'))
);

create table public.planning_workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.planning_workspaces(id) on delete cascade,
  email_normalized text not null,
  token_hash text not null,
  role text not null default 'partner',
  invited_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint planning_workspace_invites_email_length check (char_length(email_normalized) between 3 and 320 and email_normalized = lower(btrim(email_normalized))),
  constraint planning_workspace_invites_token_hash_format check (
    char_length(token_hash) = 64
    and token_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint planning_workspace_invites_role check (role = 'partner'),
  constraint planning_workspace_invites_expiry check (expires_at > created_at),
  constraint planning_workspace_invites_acceptance check (
    (accepted_at is null and accepted_by is null)
    or (accepted_at is not null and accepted_by is not null)
  ),
  constraint planning_workspace_invites_terminal_state check (
    not (accepted_at is not null and revoked_at is not null)
  )
);

create index planning_workspaces_owner_updated_idx
  on public.planning_workspaces (owner_id, updated_at desc);
create unique index planning_workspaces_owner_budget_unique
  on public.planning_workspaces (owner_id, budget_plan_id)
  where budget_plan_id is not null;
create index planning_workspace_members_user_idx
  on public.planning_workspace_members (user_id, workspace_id);
create index planning_tasks_workspace_status_idx
  on public.planning_tasks (workspace_id, status, due_date, sort_order);
create index planning_guests_workspace_sort_idx
  on public.planning_guests (workspace_id, sort_order, name);
create index planning_tables_workspace_sort_idx
  on public.planning_tables (workspace_id, sort_order);
create index planning_seating_rules_workspace_idx
  on public.planning_seating_rules (workspace_id);
create unique index planning_workspace_invites_active_email_idx
  on public.planning_workspace_invites (workspace_id, email_normalized)
  where accepted_at is null and revoked_at is null;
create unique index planning_workspace_invites_token_hash_idx
  on public.planning_workspace_invites (token_hash);

create or replace function private.can_access_planning_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.planning_workspace_members member
      where member.workspace_id = target_workspace_id
        and member.user_id = (select auth.uid())
    );
$$;

create or replace function private.owns_planning_workspace(target_workspace_id uuid)
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
      where workspace.id = target_workspace_id
        and workspace.owner_id = (select auth.uid())
    );
$$;

create or replace function private.current_verified_planning_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(auth_user.email))
  from auth.users auth_user
  where auth_user.id = (select auth.uid())
    and auth_user.email_confirmed_at is not null
    and auth_user.email is not null;
$$;

revoke all on function private.can_access_planning_workspace(uuid) from public;
revoke all on function private.owns_planning_workspace(uuid) from public;
revoke all on function private.current_verified_planning_email() from public, anon, authenticated, service_role;
grant execute on function private.can_access_planning_workspace(uuid) to authenticated;
grant execute on function private.owns_planning_workspace(uuid) to authenticated;

create or replace function public.accept_planning_workspace_invite(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  invite_record public.planning_workspace_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to accept this planning invitation'
      using errcode = 'insufficient_privilege';
  end if;

  current_email := private.current_verified_planning_email();
  if current_email is null then
    raise exception 'A confirmed email address is required to accept this planning invitation'
      using errcode = 'insufficient_privilege';
  end if;

  if raw_token is null
    or char_length(raw_token) < 32
    or char_length(raw_token) > 256
  then
    raise exception 'This planning invitation is not valid'
      using errcode = 'invalid_parameter_value';
  end if;

  select invite.*
  into invite_record
  from public.planning_workspace_invites invite
  where invite.token_hash = encode(
      extensions.digest(pg_catalog.convert_to(raw_token, 'UTF8'), 'sha256'),
      'hex'
    )
    and invite.email_normalized = current_email
    and invite.accepted_at is null
    and invite.revoked_at is null
    and invite.expires_at > pg_catalog.now()
  for update;

  if not found then
    raise exception 'This planning invitation is not valid or is no longer available'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.planning_workspace_invites
  set accepted_at = pg_catalog.now(),
      accepted_by = current_user_id
  where id = invite_record.id;

  insert into public.planning_workspace_members (workspace_id, user_id, role)
  values (invite_record.workspace_id, current_user_id, 'partner')
  on conflict (workspace_id, user_id) do nothing;

  return invite_record.workspace_id;
end;
$$;

revoke all on function public.accept_planning_workspace_invite(text) from public, anon, service_role;
grant execute on function public.accept_planning_workspace_invite(text) to authenticated;

create or replace function private.add_planning_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.planning_workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

revoke all on function private.add_planning_workspace_owner() from public;

create trigger planning_workspaces_add_owner
after insert on public.planning_workspaces
for each row execute function private.add_planning_workspace_owner();

create or replace function private.enforce_planning_workspace_member_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_owner_id uuid;
begin
  select owner_id
  into workspace_owner_id
  from public.planning_workspaces
  where id = new.workspace_id;

  if new.role = 'owner' and new.user_id <> workspace_owner_id then
    raise exception 'Only the workspace owner can hold the owner membership role'
      using errcode = 'check_violation';
  end if;

  if new.user_id = workspace_owner_id and new.role <> 'owner' then
    raise exception 'The workspace owner must retain the owner membership role'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_planning_workspace_member_role() from public;

create trigger planning_workspace_members_enforce_role
before insert or update on public.planning_workspace_members
for each row execute function private.enforce_planning_workspace_member_role();

create or replace function private.protect_planning_workspace_owner_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_owner_id uuid;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  select owner_id
  into workspace_owner_id
  from public.planning_workspaces
  where id = old.workspace_id;

  if old.user_id = workspace_owner_id then
    if tg_op = 'DELETE' then
      raise exception 'The workspace owner membership cannot be removed'
        using errcode = 'check_violation';
    end if;

    if new.user_id is distinct from old.user_id
      or new.workspace_id is distinct from old.workspace_id
      or new.role is distinct from 'owner'
    then
      raise exception 'The workspace owner membership cannot be changed'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.protect_planning_workspace_owner_member() from public;

create trigger planning_workspace_members_protect_owner
before update or delete on public.planning_workspace_members
for each row execute function private.protect_planning_workspace_owner_member();

create trigger planning_workspaces_set_updated_at
before update on public.planning_workspaces
for each row execute function public.set_updated_at();
create trigger planning_tasks_set_updated_at
before update on public.planning_tasks
for each row execute function public.set_updated_at();
create trigger planning_guests_set_updated_at
before update on public.planning_guests
for each row execute function public.set_updated_at();
create trigger planning_tables_set_updated_at
before update on public.planning_tables
for each row execute function public.set_updated_at();
create trigger planning_seats_set_updated_at
before update on public.planning_seats
for each row execute function public.set_updated_at();

alter table public.planning_workspaces enable row level security;
alter table public.planning_workspace_members enable row level security;
alter table public.planning_tasks enable row level security;
alter table public.planning_guests enable row level security;
alter table public.planning_tables enable row level security;
alter table public.planning_seats enable row level security;
alter table public.planning_seating_rules enable row level security;
alter table public.planning_workspace_invites enable row level security;

revoke all on table public.planning_workspaces from anon, authenticated;
revoke all on table public.planning_workspace_members from anon, authenticated;
revoke all on table public.planning_tasks from anon, authenticated;
revoke all on table public.planning_guests from anon, authenticated;
revoke all on table public.planning_tables from anon, authenticated;
revoke all on table public.planning_seats from anon, authenticated;
revoke all on table public.planning_seating_rules from anon, authenticated;
revoke all on table public.planning_workspace_invites from anon, authenticated;

grant select, insert, delete on table public.planning_workspaces to authenticated;
grant update (name, budget_plan_id, updated_at) on table public.planning_workspaces to authenticated;
grant select, insert, update, delete on table public.planning_workspace_members to authenticated;
grant select, insert, update, delete on table public.planning_tasks to authenticated;
grant select, insert, update, delete on table public.planning_guests to authenticated;
grant select, insert, update, delete on table public.planning_tables to authenticated;
grant select, insert, update, delete on table public.planning_seats to authenticated;
grant select, insert, update, delete on table public.planning_seating_rules to authenticated;
grant select, insert on table public.planning_workspace_invites to authenticated;
grant update (revoked_at) on table public.planning_workspace_invites to authenticated;

grant all on table public.planning_workspaces to service_role;
grant all on table public.planning_workspace_members to service_role;
grant all on table public.planning_tasks to service_role;
grant all on table public.planning_guests to service_role;
grant all on table public.planning_tables to service_role;
grant all on table public.planning_seats to service_role;
grant all on table public.planning_seating_rules to service_role;
grant all on table public.planning_workspace_invites to service_role;

create policy "Members read planning workspaces"
  on public.planning_workspaces for select to authenticated
  using ((select private.can_access_planning_workspace(id)));
create policy "Users create owned planning workspaces"
  on public.planning_workspaces for insert to authenticated
  with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));
create policy "Members update planning workspaces"
  on public.planning_workspaces for update to authenticated
  using ((select private.can_access_planning_workspace(id)))
  with check ((select private.can_access_planning_workspace(id)));
create policy "Owners delete planning workspaces"
  on public.planning_workspaces for delete to authenticated
  using ((select private.owns_planning_workspace(id)));

create policy "Owners and self read workspace members"
  on public.planning_workspace_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.owns_planning_workspace(workspace_id))
  );
create policy "Owners add workspace members"
  on public.planning_workspace_members for insert to authenticated
  with check ((select private.owns_planning_workspace(workspace_id)));
create policy "Owners update workspace members"
  on public.planning_workspace_members for update to authenticated
  using ((select private.owns_planning_workspace(workspace_id)))
  with check ((select private.owns_planning_workspace(workspace_id)));
create policy "Owners delete workspace members"
  on public.planning_workspace_members for delete to authenticated
  using ((select private.owns_planning_workspace(workspace_id)));

create policy "Members read planning tasks"
  on public.planning_tasks for select to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members create planning tasks"
  on public.planning_tasks for insert to authenticated
  with check ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members update planning tasks"
  on public.planning_tasks for update to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)))
  with check ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members delete planning tasks"
  on public.planning_tasks for delete to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));

create policy "Members read planning guests"
  on public.planning_guests for select to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members create planning guests"
  on public.planning_guests for insert to authenticated
  with check ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members update planning guests"
  on public.planning_guests for update to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)))
  with check ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members delete planning guests"
  on public.planning_guests for delete to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));

create policy "Members read planning tables"
  on public.planning_tables for select to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members create planning tables"
  on public.planning_tables for insert to authenticated
  with check ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members update planning tables"
  on public.planning_tables for update to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)))
  with check ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members delete planning tables"
  on public.planning_tables for delete to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));

create policy "Members read planning seats"
  on public.planning_seats for select to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members create planning seats"
  on public.planning_seats for insert to authenticated
  with check ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members update planning seats"
  on public.planning_seats for update to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)))
  with check ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members delete planning seats"
  on public.planning_seats for delete to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));

create policy "Members read planning seating rules"
  on public.planning_seating_rules for select to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members create planning seating rules"
  on public.planning_seating_rules for insert to authenticated
  with check ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members update planning seating rules"
  on public.planning_seating_rules for update to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)))
  with check ((select private.can_access_planning_workspace(workspace_id)));
create policy "Members delete planning seating rules"
  on public.planning_seating_rules for delete to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));

create policy "Owners read workspace invites"
  on public.planning_workspace_invites for select to authenticated
  using ((select private.owns_planning_workspace(workspace_id)));
create policy "Owners create workspace invites"
  on public.planning_workspace_invites for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and accepted_at is null
    and accepted_by is null
    and revoked_at is null
    and (select private.owns_planning_workspace(workspace_id))
  );
create policy "Owners update workspace invites"
  on public.planning_workspace_invites for update to authenticated
  using ((select private.owns_planning_workspace(workspace_id)))
  with check (
    invited_by = (select auth.uid())
    and (select private.owns_planning_workspace(workspace_id))
  );
