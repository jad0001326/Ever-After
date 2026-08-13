-- The legacy profile policy scoped rows but not columns, so an authenticated
-- user could update their own role and satisfy every administrator check.
-- No application path writes public.profiles as the authenticated role; Auth
-- provisioning and trusted maintenance use separate privileged roles.

begin;

revoke update on public.profiles from authenticated;
revoke update (id, email, full_name, role, created_at, updated_at)
  on public.profiles from authenticated;

drop policy if exists "Users can update own profile" on public.profiles;

do $verify$
begin
  if has_table_privilege('authenticated', 'public.profiles', 'update') then
    raise exception 'Authenticated retains table-level profile UPDATE';
  end if;

  if exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'profiles'
      and grantee = 'authenticated'
      and privilege_type = 'UPDATE'
  ) then
    raise exception 'Authenticated retains column-level profile UPDATE';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    raise exception 'Unsafe self-update profile policy remains';
  end if;
end
$verify$;

notify pgrst, 'reload schema';

commit;
