-- Security hardening applied to production on 2026-07-17.
-- Keeps SECURITY DEFINER helpers out of the exposed public API schema,
-- removes public object listing, and constrains venue-image uploads.

begin;

create schema if not exists private authorization postgres;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role, supabase_auth_admin;

do $relocate$
begin
  if to_regprocedure('public.is_admin()') is not null then
    execute 'alter function public.is_admin() set schema private';
  elsif to_regprocedure('private.is_admin()') is null then
    raise exception 'is_admin() was not found';
  end if;

  if to_regprocedure('public.handle_new_user()') is not null then
    execute 'alter function public.handle_new_user() set schema private';
  elsif to_regprocedure('private.handle_new_user()') is null then
    raise exception 'handle_new_user() was not found';
  end if;
end
$relocate$;

alter function private.is_admin() set search_path to pg_catalog;
revoke all on function private.is_admin() from public, anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;

alter function private.handle_new_user() set search_path to pg_catalog;
revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function private.handle_new_user() to supabase_auth_admin;

do $search_paths$
begin
  if to_regprocedure('public.reject_enrichment_change_log_mutation()') is not null then
    execute 'alter function public.reject_enrichment_change_log_mutation() set search_path to pg_catalog';
  end if;

  if to_regprocedure('public.everaft_mcp_access_token_hook(jsonb)') is not null then
    execute 'alter function public.everaft_mcp_access_token_hook(jsonb) set search_path to pg_catalog';
  end if;
end
$search_paths$;

-- This was a production-only recovery backup, so fresh environments may not have it.
do $secure_backup$
begin
  if to_regclass('public.venue_price_backup_20260518') is not null then
    execute 'alter table public.venue_price_backup_20260518 enable row level security';
    execute 'revoke all on table public.venue_price_backup_20260518 from public, anon, authenticated, service_role';
    execute 'alter table public.venue_price_backup_20260518 set schema private';
  elsif to_regclass('private.venue_price_backup_20260518') is not null then
    execute 'alter table private.venue_price_backup_20260518 enable row level security';
    execute 'revoke all on table private.venue_price_backup_20260518 from public, anon, authenticated, service_role';
  end if;
end
$secure_backup$;

drop policy if exists "Public venue image reads" on storage.objects;
drop policy if exists "Admins read venue image objects" on storage.objects;

create policy "Admins read venue image objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'venue-images'
  and (select private.is_admin())
);

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'venue-images';

do $verify$
begin
  if to_regprocedure('private.is_admin()') is null
     or to_regprocedure('public.is_admin()') is not null then
    raise exception 'is_admin relocation failed';
  end if;

  if to_regprocedure('private.handle_new_user()') is null
     or to_regprocedure('public.handle_new_user()') is not null then
    raise exception 'handle_new_user relocation failed';
  end if;

  if to_regclass('public.venue_price_backup_20260518') is not null then
    raise exception 'backup table remains in the public schema';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where t.tgname = 'on_auth_user_created'
      and n.nspname = 'private'
      and p.proname = 'handle_new_user'
      and not t.tgisinternal
  ) then
    raise exception 'auth trigger dependency did not follow function';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public venue image reads'
  ) then
    raise exception 'public storage listing policy still exists';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'venue-images'
      and public = true
      and file_size_limit = 10485760
      and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']::text[]
      and cardinality(allowed_mime_types) = 3
  ) then
    raise exception 'venue-images bucket restrictions failed';
  end if;
end
$verify$;

notify pgrst, 'reload schema';

commit;
