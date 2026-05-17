-- Ever After Supabase/PostgreSQL foundation
-- Run this in the Supabase SQL editor before treating the app as live.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.venue_status as enum ('draft', 'published');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.enquiry_status as enum ('new', 'contacted', 'closed');
exception
  when duplicate_object then null;
end $$;

-- Previous app versions created public.users. Keep existing data by renaming it
-- to public.profiles when profiles does not already exist.
do $$
begin
  if to_regclass('public.profiles') is null and to_regclass('public.users') is not null then
    alter table public.users rename to profiles;
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  alter column role drop default,
  alter column role type text using role::text;

alter table public.profiles
  alter column role set default 'user';

update public.profiles
set role = 'user'
where role is null;

alter table public.profiles
  alter column role set not null;

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

drop table if exists public.users cascade;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type text not null check (type in ('Castle', 'Barn', 'Luxury Hotel', 'Country Estate')),
  region text not null,
  town text not null,
  country text not null default 'Scotland',
  summary text not null,
  description text not null,
  price_from integer not null check (price_from >= 0),
  price_to integer not null check (price_to >= price_from),
  capacity_min integer not null check (capacity_min > 0),
  capacity_max integer not null check (capacity_max >= capacity_min),
  hero_image text not null,
  official_website_url text,
  official_gallery_url text,
  vendor_contact_email text,
  listing_status text not null default 'published' check (listing_status in ('draft', 'published', 'claimed', 'archived')),
  claim_status text not null default 'unclaimed' check (claim_status in ('unclaimed', 'pending', 'approved', 'rejected')),
  image_permission_status text not null default 'representative' check (image_permission_status in ('representative', 'approved', 'rejected', 'pending')),
  image_credit text,
  image_is_representative boolean not null default true,
  is_claimed boolean not null default false,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  invite_sent_at timestamptz,
  invite_status text not null default 'not_sent' check (invite_status in ('not_sent', 'sent', 'bounced', 'replied', 'claimed')),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_featured boolean not null default false,
  status public.venue_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.venues
  add column if not exists official_website_url text,
  add column if not exists official_gallery_url text,
  add column if not exists vendor_contact_email text,
  add column if not exists listing_status text not null default 'published',
  add column if not exists claim_status text not null default 'unclaimed',
  add column if not exists image_permission_status text not null default 'representative',
  add column if not exists image_credit text,
  add column if not exists image_is_representative boolean not null default true,
  add column if not exists is_claimed boolean not null default false,
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists invite_sent_at timestamptz,
  add column if not exists invite_status text not null default 'not_sent';

alter table public.venues
  alter column image_permission_status set default 'representative';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venues_listing_status_check') then
    alter table public.venues add constraint venues_listing_status_check check (listing_status in ('draft', 'published', 'claimed', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venues_claim_status_check') then
    alter table public.venues add constraint venues_claim_status_check check (claim_status in ('unclaimed', 'pending', 'approved', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venues_image_permission_status_check') then
    alter table public.venues add constraint venues_image_permission_status_check check (image_permission_status in ('representative', 'approved', 'rejected', 'pending'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venues_invite_status_check') then
    alter table public.venues add constraint venues_invite_status_check check (invite_status in ('not_sent', 'sent', 'bounced', 'replied', 'claimed'));
  end if;
end $$;

create table if not exists public.venue_images (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  url text not null,
  alt text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.amenities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text unique,
  contact_phone text,
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_users (
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner',
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now(),
  primary key (vendor_id, user_id)
);

create table if not exists public.venue_claims (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  claimant_user_id uuid not null references public.profiles(id) on delete cascade,
  claimant_name text not null,
  claimant_email text not null,
  claimant_role text not null,
  business_email text not null,
  business_phone text not null,
  message text not null,
  evidence_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  permission_confirmed boolean not null default false,
  terms_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.venue_claim_audit_log (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.venue_claims(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete cascade,
  admin_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_update_requests (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  vendor_user_id uuid not null references public.profiles(id) on delete cascade,
  requested_name text,
  requested_summary text,
  requested_description text,
  requested_official_website_url text,
  requested_official_gallery_url text,
  requested_message text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.venue_amenities (
  venue_id uuid not null references public.venues(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete cascade,
  primary key (venue_id, amenity_id)
);

create table if not exists public.favourites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  wedding_date date,
  guest_count integer check (guest_count is null or guest_count > 0),
  message text not null,
  status public.enquiry_status not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists venues_search_idx on public.venues using gin (
  to_tsvector('english', name || ' ' || town || ' ' || region || ' ' || type || ' ' || summary)
);
create index if not exists venues_price_idx on public.venues (price_from);
create index if not exists venues_capacity_idx on public.venues (capacity_max);
create index if not exists venues_type_idx on public.venues (type);
create index if not exists venues_featured_idx on public.venues (is_featured) where status = 'published';
create index if not exists venues_claim_status_idx on public.venues (claim_status, is_claimed);
create index if not exists venues_invite_status_idx on public.venues (invite_status, invite_sent_at desc);
create index if not exists venue_images_venue_sort_idx on public.venue_images (venue_id, sort_order);
create index if not exists venue_claims_status_idx on public.venue_claims (status, created_at desc);
create index if not exists vendor_update_requests_status_idx on public.vendor_update_requests (status, created_at desc);
create index if not exists enquiries_venue_status_idx on public.enquiries (venue_id, status, created_at desc);
create index if not exists favourites_user_idx on public.favourites (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists venues_set_updated_at on public.venues;
create trigger venues_set_updated_at
before update on public.venues
for each row execute function public.set_updated_at();

drop trigger if exists vendors_set_updated_at on public.vendors;
create trigger vendors_set_updated_at
before update on public.vendors
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.venue_images enable row level security;
alter table public.amenities enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_users enable row level security;
alter table public.venue_claims enable row level security;
alter table public.venue_claim_audit_log enable row level security;
alter table public.vendor_update_requests enable row level security;
alter table public.venue_amenities enable row level security;
alter table public.favourites enable row level security;
alter table public.enquiries enable row level security;

grant usage on schema public to anon, authenticated;

grant select on public.venues to anon, authenticated;
grant select on public.venue_images to anon, authenticated;
grant select on public.amenities to anon, authenticated;
grant select on public.venue_amenities to anon, authenticated;

grant select, insert, update, delete on public.venues to authenticated;
grant select, insert, update, delete on public.venue_images to authenticated;
grant select, insert, update, delete on public.amenities to authenticated;
grant select, insert, update, delete on public.vendors to authenticated;
grant select, insert, update, delete on public.vendor_users to authenticated;
grant select, insert, update, delete on public.venue_claims to authenticated;
grant select, insert, update, delete on public.venue_claim_audit_log to authenticated;
grant select, insert, update, delete on public.vendor_update_requests to authenticated;
grant select, insert, update, delete on public.venue_amenities to authenticated;

grant select, update on public.profiles to authenticated;

grant select, insert, update, delete on public.favourites to authenticated;

grant insert on public.enquiries to anon, authenticated;
grant select, update, delete on public.enquiries to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Users can read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "Users can update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins can read profiles" on public.profiles for select using (public.is_admin());

drop policy if exists "Published venues are public" on public.venues;
drop policy if exists "Admins manage venues" on public.venues;
create policy "Published venues are public" on public.venues for select using (status = 'published' or public.is_admin());
create policy "Admins manage venues" on public.venues for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Venue images are public" on public.venue_images;
drop policy if exists "Admins manage venue images" on public.venue_images;
create policy "Venue images are public" on public.venue_images for select using (
  exists (select 1 from public.venues where venues.id = venue_images.venue_id and (venues.status = 'published' or public.is_admin()))
);
create policy "Admins manage venue images" on public.venue_images for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Amenities are public" on public.amenities;
drop policy if exists "Admins manage amenities" on public.amenities;
create policy "Amenities are public" on public.amenities for select using (true);
create policy "Admins manage amenities" on public.amenities for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage vendors" on public.vendors;
drop policy if exists "Vendor users read own vendor" on public.vendors;
create policy "Admins manage vendors" on public.vendors for all using (public.is_admin()) with check (public.is_admin());
create policy "Vendor users read own vendor" on public.vendors for select using (
  exists (select 1 from public.vendor_users where vendor_users.vendor_id = vendors.id and vendor_users.user_id = auth.uid())
);

drop policy if exists "Admins manage vendor users" on public.vendor_users;
drop policy if exists "Vendor users read own links" on public.vendor_users;
create policy "Admins manage vendor users" on public.vendor_users for all using (public.is_admin()) with check (public.is_admin());
create policy "Vendor users read own links" on public.vendor_users for select using (user_id = auth.uid());

drop policy if exists "Users create own venue claims" on public.venue_claims;
drop policy if exists "Users read own venue claims" on public.venue_claims;
drop policy if exists "Admins manage venue claims" on public.venue_claims;
create policy "Users create own venue claims" on public.venue_claims for insert with check (claimant_user_id = auth.uid());
create policy "Users read own venue claims" on public.venue_claims for select using (claimant_user_id = auth.uid() or public.is_admin());
create policy "Admins manage venue claims" on public.venue_claims for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage venue claim audit log" on public.venue_claim_audit_log;
create policy "Admins manage venue claim audit log" on public.venue_claim_audit_log for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Vendor users create update requests" on public.vendor_update_requests;
drop policy if exists "Vendor users read own update requests" on public.vendor_update_requests;
drop policy if exists "Admins manage vendor update requests" on public.vendor_update_requests;
create policy "Vendor users create update requests" on public.vendor_update_requests for insert with check (vendor_user_id = auth.uid());
create policy "Vendor users read own update requests" on public.vendor_update_requests for select using (vendor_user_id = auth.uid() or public.is_admin());
create policy "Admins manage vendor update requests" on public.vendor_update_requests for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Venue amenities are public" on public.venue_amenities;
drop policy if exists "Admins manage venue amenities" on public.venue_amenities;
create policy "Venue amenities are public" on public.venue_amenities for select using (
  exists (select 1 from public.venues where venues.id = venue_amenities.venue_id and (venues.status = 'published' or public.is_admin()))
);
create policy "Admins manage venue amenities" on public.venue_amenities for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users manage own favourites" on public.favourites;
create policy "Users manage own favourites" on public.favourites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users create enquiries" on public.enquiries;
drop policy if exists "Users read own enquiries" on public.enquiries;
drop policy if exists "Admins manage enquiries" on public.enquiries;
create policy "Users create enquiries" on public.enquiries for insert with check (user_id is null or user_id = auth.uid());
create policy "Users read own enquiries" on public.enquiries for select using (user_id = auth.uid() or public.is_admin());
create policy "Admins manage enquiries" on public.enquiries for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('venue-images', 'venue-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public venue image reads" on storage.objects;
drop policy if exists "Admins upload venue images" on storage.objects;
drop policy if exists "Admins update venue images" on storage.objects;
drop policy if exists "Admins delete venue images" on storage.objects;

create policy "Public venue image reads"
on storage.objects for select
using (bucket_id = 'venue-images');

create policy "Admins upload venue images"
on storage.objects for insert
with check (bucket_id = 'venue-images' and public.is_admin());

create policy "Admins update venue images"
on storage.objects for update
using (bucket_id = 'venue-images' and public.is_admin())
with check (bucket_id = 'venue-images' and public.is_admin());

create policy "Admins delete venue images"
on storage.objects for delete
using (bucket_id = 'venue-images' and public.is_admin());

notify pgrst, 'reload schema';
