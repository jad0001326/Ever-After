-- Ever After Supabase/PostgreSQL schema
-- Run in the Supabase SQL editor, then create the first admin by updating public.profiles.role.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('user', 'admin');
create type public.venue_status as enum ('draft', 'published');
create type public.enquiry_status as enum ('new', 'contacted', 'closed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

create table public.venues (
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
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_featured boolean not null default false,
  status public.venue_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.venue_images (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  url text not null,
  alt text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table public.venue_amenities (
  venue_id uuid not null references public.venues(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete cascade,
  primary key (venue_id, amenity_id)
);

create table public.favourites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create table public.enquiries (
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

create index venues_search_idx on public.venues using gin (
  to_tsvector('english', name || ' ' || town || ' ' || region || ' ' || type || ' ' || summary)
);
create index venues_price_idx on public.venues (price_from);
create index venues_capacity_idx on public.venues (capacity_max);
create index venues_type_idx on public.venues (type);
create index venues_featured_idx on public.venues (is_featured) where status = 'published';
create index venue_images_venue_sort_idx on public.venue_images (venue_id, sort_order);
create index enquiries_venue_status_idx on public.enquiries (venue_id, status, created_at desc);
create index favourites_user_idx on public.favourites (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger venues_set_updated_at
before update on public.venues
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.venue_images enable row level security;
alter table public.amenities enable row level security;
alter table public.venue_amenities enable row level security;
alter table public.favourites enable row level security;
alter table public.enquiries enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create policy "Users can read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "Users can update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Published venues are public" on public.venues for select using (status = 'published' or public.is_admin());
create policy "Admins manage venues" on public.venues for all using (public.is_admin()) with check (public.is_admin());

create policy "Venue images are public" on public.venue_images for select using (
  exists (select 1 from public.venues where venues.id = venue_images.venue_id and (venues.status = 'published' or public.is_admin()))
);
create policy "Admins manage venue images" on public.venue_images for all using (public.is_admin()) with check (public.is_admin());

create policy "Amenities are public" on public.amenities for select using (true);
create policy "Admins manage amenities" on public.amenities for all using (public.is_admin()) with check (public.is_admin());

create policy "Venue amenities are public" on public.venue_amenities for select using (true);
create policy "Admins manage venue amenities" on public.venue_amenities for all using (public.is_admin()) with check (public.is_admin());

create policy "Users manage own favourites" on public.favourites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users create enquiries" on public.enquiries for insert with check (user_id is null or user_id = auth.uid());
create policy "Users read own enquiries" on public.enquiries for select using (user_id = auth.uid() or public.is_admin());
create policy "Admins manage enquiries" on public.enquiries for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('venue-images', 'venue-images', true)
on conflict (id) do nothing;

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
