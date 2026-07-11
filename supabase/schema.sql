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
  create type public.enquiry_status as enum ('new', 'contacted', 'converted', 'closed');
exception
  when duplicate_object then null;
end $$;

alter type public.enquiry_status add value if not exists 'converted';

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
  price_from integer check (price_from is null or price_from >= 0),
  price_to integer check (price_to is null or price_from is null or price_to >= price_from),
  capacity_min integer not null check (capacity_min > 0),
  capacity_max integer not null check (capacity_max >= capacity_min),
  hero_image text not null,
  official_website_url text,
  official_gallery_url text,
  vendor_contact_email text,
  vendor_contact_source_url text,
  vendor_contact_verified_at timestamptz,
  vendor_contact_verified_by uuid references public.profiles(id) on delete set null,
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
  outreach_notes text,
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
  add column if not exists vendor_contact_source_url text,
  add column if not exists vendor_contact_verified_at timestamptz,
  add column if not exists vendor_contact_verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists listing_status text not null default 'published',
  add column if not exists claim_status text not null default 'unclaimed',
  add column if not exists image_permission_status text not null default 'representative',
  add column if not exists image_credit text,
  add column if not exists image_is_representative boolean not null default true,
  add column if not exists is_claimed boolean not null default false,
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists invite_sent_at timestamptz,
  add column if not exists invite_status text not null default 'not_sent',
  add column if not exists outreach_notes text;

alter table public.venues
  alter column price_from drop not null,
  alter column price_to drop not null;

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.enquiries
  add column if not exists updated_at timestamptz not null default now();

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
create index if not exists enquiries_status_created_idx on public.enquiries (status, created_at desc);
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

drop trigger if exists enquiries_set_updated_at on public.enquiries;
create trigger enquiries_set_updated_at
before update on public.enquiries
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
drop policy if exists "Vendor users read venue enquiries" on public.enquiries;
drop policy if exists "Vendor users update venue enquiries" on public.enquiries;
create policy "Users create enquiries" on public.enquiries for insert with check (user_id is null or user_id = auth.uid());
create policy "Users read own enquiries" on public.enquiries for select using (user_id = auth.uid() or public.is_admin());
create policy "Vendor users read venue enquiries" on public.enquiries for select using (
  exists (
    select 1
    from public.venues
    where venues.id = enquiries.venue_id
      and venues.claimed_by = auth.uid()
      and venues.is_claimed = true
  )
);
create policy "Vendor users update venue enquiries" on public.enquiries for update using (
  exists (
    select 1
    from public.venues
    where venues.id = enquiries.venue_id
      and venues.claimed_by = auth.uid()
      and venues.is_claimed = true
  )
) with check (
  exists (
    select 1
    from public.venues
    where venues.id = enquiries.venue_id
      and venues.claimed_by = auth.uid()
      and venues.is_claimed = true
  )
);
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

-- Supplier applications and double-opt-in newsletter subscriptions are kept
-- server-only. Public forms call trusted server actions which validate, rate
-- limit and use SUPABASE_SERVICE_ROLE_KEY; there are deliberately no public
-- RLS policies for these records.
create table if not exists public.supplier_applications (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(business_name) between 1 and 120),
  owner_name text not null check (char_length(owner_name) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  phone text not null check (char_length(phone) <= 40),
  website_url text,
  instagram_handle text,
  facebook_url text,
  location text not null check (char_length(location) between 1 and 120),
  coverage_radius_miles integer not null check (coverage_radius_miles between 0 and 500),
  category text not null,
  description text not null check (char_length(description) between 40 and 2000),
  services text not null check (char_length(services) between 3 and 1000),
  pricing text,
  gallery_urls text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create index if not exists supplier_applications_status_created_idx
  on public.supplier_applications (status, created_at desc);
create index if not exists supplier_applications_email_idx
  on public.supplier_applications (lower(email));

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) <= 254),
  status text not null default 'pending' check (status in ('pending', 'active', 'unsubscribed')),
  confirmation_token_hash text,
  unsubscribe_token_hash text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.newsletter_subscribers
  add column if not exists unsubscribe_token_hash text;

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status, created_at desc);

drop trigger if exists newsletter_subscribers_set_updated_at on public.newsletter_subscribers;
create trigger newsletter_subscribers_set_updated_at
before update on public.newsletter_subscribers
for each row execute function public.set_updated_at();

alter table public.supplier_applications enable row level security;
alter table public.newsletter_subscribers enable row level security;
revoke all on public.supplier_applications from anon, authenticated;
revoke all on public.newsletter_subscribers from anon, authenticated;

-- Approval-gated venue outreach campaigns. These records stay server-only;
-- authenticated admins reach them through trusted server code.
create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'initial_invite' check (kind in ('initial_invite', 'follow_up')),
  source text not null default 'admin' check (source in ('admin', 'chatgpt')),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'partially_sent', 'failed', 'cancelled')),
  subject text not null check (char_length(subject) between 1 and 160),
  preheader text not null check (char_length(preheader) between 1 and 220),
  intro_text text not null check (char_length(intro_text) between 20 and 2000),
  offer_text text not null check (char_length(offer_text) between 10 and 1000),
  audience_filter jsonb not null default '{}'::jsonb,
  approval_fingerprint text unique,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  send_attempts integer not null default 0 check (send_attempts >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  venue_slug text not null,
  business_name text not null,
  town text not null,
  region text not null,
  email text not null check (char_length(email) <= 254),
  normalized_email text generated always as (lower(btrim(email))) stored,
  contact_source_url text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed', 'bounced', 'complained', 'replied', 'unsubscribed', 'suppressed')),
  resend_email_id text,
  unsubscribe_token_hash text unique,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, normalized_email)
);

alter table public.outreach_campaign_recipients
  add column if not exists contact_source_url text;

create table if not exists public.outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  normalized_email text generated always as (lower(btrim(email))) stored,
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained', 'provider_suppressed', 'manual')),
  source text not null default 'recipient',
  created_at timestamptz not null default now(),
  unique (normalized_email)
);

create table if not exists public.outreach_email_events (
  id text primary key,
  resend_email_id text not null,
  event_type text not null,
  event_created_at timestamptz,
  received_at timestamptz not null default now()
);

create index if not exists outreach_campaigns_status_created_idx
  on public.outreach_campaigns (status, created_at desc);
create index if not exists outreach_campaign_recipients_campaign_status_idx
  on public.outreach_campaign_recipients (campaign_id, status);
create index if not exists outreach_campaign_recipients_venue_idx
  on public.outreach_campaign_recipients (venue_id, created_at desc);
create unique index if not exists outreach_campaign_recipients_resend_id_idx
  on public.outreach_campaign_recipients (resend_email_id)
  where resend_email_id is not null;
create index if not exists outreach_email_events_resend_idx
  on public.outreach_email_events (resend_email_id, received_at desc);

drop trigger if exists outreach_campaigns_set_updated_at on public.outreach_campaigns;
create trigger outreach_campaigns_set_updated_at
before update on public.outreach_campaigns
for each row execute function public.set_updated_at();

drop trigger if exists outreach_campaign_recipients_set_updated_at on public.outreach_campaign_recipients;
create trigger outreach_campaign_recipients_set_updated_at
before update on public.outreach_campaign_recipients
for each row execute function public.set_updated_at();

alter table public.outreach_campaigns enable row level security;
alter table public.outreach_campaign_recipients enable row level security;
alter table public.outreach_suppressions enable row level security;
alter table public.outreach_email_events enable row level security;
revoke all on public.outreach_campaigns from anon, authenticated;
revoke all on public.outreach_campaign_recipients from anon, authenticated;
revoke all on public.outreach_suppressions from anon, authenticated;
revoke all on public.outreach_email_events from anon, authenticated;

-- Select this function under Authentication > Hooks > Custom Access Token.
-- OAuth tokens are bound to the production EverAft MCP resource; ordinary
-- website sessions do not have client_id and keep their standard audience.
create or replace function public.everaft_mcp_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  oauth_client_id text;
begin
  claims := event -> 'claims';
  oauth_client_id := coalesce(event ->> 'client_id', claims ->> 'client_id');
  if oauth_client_id is not null then
    claims := jsonb_set(claims, '{aud}', to_jsonb('https://www.everaft.co.uk/api/mcp'::text));
    claims := jsonb_set(claims, '{everaft_mcp}', 'true'::jsonb);
  end if;
  return jsonb_build_object('claims', claims);
end;
$$;

grant execute on function public.everaft_mcp_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.everaft_mcp_access_token_hook(jsonb) from anon, authenticated, public;

notify pgrst, 'reload schema';
