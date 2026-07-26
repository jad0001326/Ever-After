-- Adds the shared wedding profile that extends the existing Budget Plan basics
-- with planning priorities and discovery preferences.

create table public.planning_workspace_profiles (
  workspace_id uuid primary key references public.planning_workspaces(id) on delete cascade,
  wedding_date date,
  guest_count integer,
  location text,
  date_flexibility text not null default 'not_set',
  location_flexible boolean not null default false,
  priorities text[] not null default '{}',
  venue_styles text[] not null default '{}',
  photography_styles text[] not null default '{}',
  vision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_workspace_profiles_guest_count check (
    guest_count is null or guest_count between 1 and 10000
  ),
  constraint planning_workspace_profiles_location_length check (
    location is null or char_length(btrim(location)) between 1 and 160
  ),
  constraint planning_workspace_profiles_date_flexibility check (
    date_flexibility in ('fixed', 'few_days', 'few_weeks', 'season_only', 'not_set')
  ),
  constraint planning_workspace_profiles_priorities_count check (
    cardinality(priorities) <= 5
  ),
  constraint planning_workspace_profiles_priorities_values check (
    priorities <@ array[
      'venue',
      'guest_experience',
      'photography',
      'food',
      'music',
      'style',
      'accommodation',
      'accessibility',
      'sustainability',
      'value'
    ]::text[]
  ),
  constraint planning_workspace_profiles_venue_styles_count check (
    cardinality(venue_styles) <= 8
  ),
  constraint planning_workspace_profiles_photography_styles_count check (
    cardinality(photography_styles) <= 8
  ),
  constraint planning_workspace_profiles_style_lengths check (
    array_position(venue_styles || photography_styles, '') is null
    and char_length(array_to_string(venue_styles || photography_styles, '')) <= 1280
  ),
  constraint planning_workspace_profiles_vision_length check (
    vision is null or char_length(vision) <= 1000
  )
);

create trigger planning_workspace_profiles_set_updated_at
before update on public.planning_workspace_profiles
for each row execute function public.set_updated_at();

create trigger planning_workspace_profiles_touch_workspace
after insert or update or delete on public.planning_workspace_profiles
for each row execute function private.touch_planning_workspace_from_child();

alter table public.planning_workspace_profiles enable row level security;

revoke all on table public.planning_workspace_profiles from anon, authenticated;
grant select, insert, update, delete on table public.planning_workspace_profiles to authenticated;
grant all on table public.planning_workspace_profiles to service_role;

create policy "Members read planning workspace profiles"
  on public.planning_workspace_profiles for select to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));

create policy "Members create planning workspace profiles"
  on public.planning_workspace_profiles for insert to authenticated
  with check ((select private.can_access_planning_workspace(workspace_id)));

create policy "Members update planning workspace profiles"
  on public.planning_workspace_profiles for update to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)))
  with check ((select private.can_access_planning_workspace(workspace_id)));

create policy "Members delete planning workspace profiles"
  on public.planning_workspace_profiles for delete to authenticated
  using ((select private.can_access_planning_workspace(workspace_id)));

create or replace function public.import_planning_workspace_snapshot_v2(
  workspace_snapshot jsonb,
  target_workspace_id uuid default null,
  expected_updated_at timestamptz default null
)
returns table (
  workspace_id uuid,
  workspace_updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  profile jsonb := workspace_snapshot->'profile';
  resolved_workspace_id uuid;
begin
  if profile is null
    or jsonb_typeof(profile) <> 'object'
    or (profile->>'schemaVersion')::integer <> 1
    or jsonb_typeof(profile->'priorities') <> 'array'
    or jsonb_typeof(profile->'venueStyles') <> 'array'
    or jsonb_typeof(profile->'photographyStyles') <> 'array'
  then
    raise exception 'A complete versioned wedding profile is required'
      using errcode = 'invalid_parameter_value';
  end if;

  select imported.workspace_id
  into resolved_workspace_id
  from public.import_planning_workspace_snapshot(
    workspace_snapshot,
    target_workspace_id,
    expected_updated_at
  ) imported;

  if resolved_workspace_id is null then
    raise exception 'The planning workspace could not be imported'
      using errcode = 'data_exception';
  end if;

  insert into public.planning_workspace_profiles (
    workspace_id,
    wedding_date,
    guest_count,
    location,
    date_flexibility,
    location_flexible,
    priorities,
    venue_styles,
    photography_styles,
    vision
  )
  values (
    resolved_workspace_id,
    (profile->>'weddingDate')::date,
    (profile->>'guestCount')::integer,
    nullif(btrim(profile->>'location'), ''),
    profile->>'dateFlexibility',
    (profile->>'locationFlexible')::boolean,
    array(
      select jsonb_array_elements_text(profile->'priorities')
    ),
    array(
      select jsonb_array_elements_text(profile->'venueStyles')
    ),
    array(
      select jsonb_array_elements_text(profile->'photographyStyles')
    ),
    nullif(btrim(profile->>'vision'), '')
  )
  on conflict (workspace_id) do update
  set wedding_date = excluded.wedding_date,
      guest_count = excluded.guest_count,
      location = excluded.location,
      date_flexibility = excluded.date_flexibility,
      location_flexible = excluded.location_flexible,
      priorities = excluded.priorities,
      venue_styles = excluded.venue_styles,
      photography_styles = excluded.photography_styles,
      vision = excluded.vision;

  return query
  select workspace.id, workspace.updated_at
  from public.planning_workspaces workspace
  where workspace.id = resolved_workspace_id;
end;
$$;

revoke all on function public.import_planning_workspace_snapshot_v2(
  jsonb,
  uuid,
  timestamptz
) from public, anon, service_role;

grant execute on function public.import_planning_workspace_snapshot_v2(
  jsonb,
  uuid,
  timestamptz
) to authenticated;
