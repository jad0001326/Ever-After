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

-- Phase 10: reviewable, idempotent business enrichment workflow.
-- Run after the base schema. Dry-run research can remain filesystem-only; these
-- private tables hold staged evidence and approved changes after review.

create table if not exists public.enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'dry_run' check (mode in ('dry_run', 'review', 'apply', 'rollback')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  source_fingerprint text not null unique check (char_length(source_fingerprint) between 1 and 128),
  scope jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  external_usage jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrichment_records (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.enrichment_runs(id) on delete cascade,
  entity_type text not null check (entity_type in ('venue', 'vendor', 'supplier_application')),
  entity_id uuid not null,
  entity_snapshot jsonb not null default '{}'::jsonb,
  eligibility_blockers text[] not null default '{}'::text[],
  quality_blockers text[] not null default '{}'::text[],
  missing_fields text[] not null default '{}'::text[],
  business_status text not null default 'uncertain' check (business_status in ('active', 'likely_active', 'temporarily_closed', 'closed', 'rebranded', 'duplicate', 'uncertain')),
  research_status text not null default 'pending' check (research_status in ('pending', 'processing', 'researched', 'verified', 'manual_review', 'failed', 'skipped')),
  requires_manual_review boolean not null default false,
  before_outreach_eligible boolean not null default false,
  after_outreach_eligible boolean,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz default now(),
  locked_by text,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, entity_type, entity_id),
  check ((locked_by is null) = (locked_at is null))
);

create table if not exists public.business_enrichment_profiles (
  entity_type text not null check (entity_type in ('venue', 'vendor', 'supplier_application')),
  entity_id uuid not null,
  trading_name text,
  contact_page_url text,
  enquiry_page_url text,
  public_email text,
  enquiries_email text,
  wedding_email text,
  sales_email text,
  phone text,
  full_address text,
  address_line_1 text,
  address_line_2 text,
  town text,
  county_region text,
  country text,
  postcode text,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  linkedin_url text,
  services jsonb not null default '[]'::jsonb,
  areas_served jsonb not null default '[]'::jsonb,
  structured_pricing jsonb not null default '{}'::jsonb,
  business_status text not null default 'uncertain' check (business_status in ('active', 'likely_active', 'temporarily_closed', 'closed', 'rebranded', 'duplicate', 'uncertain')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

create table if not exists public.enrichment_field_proposals (
  id uuid primary key default gen_random_uuid(),
  enrichment_record_id uuid not null references public.enrichment_records(id) on delete cascade,
  target_table text not null check (target_table in ('venues', 'business_enrichment_profiles')),
  target_field text not null check (char_length(target_field) between 1 and 80),
  previous_value jsonb,
  proposed_value jsonb not null,
  source_url text not null check (char_length(source_url) between 1 and 2048),
  source_title text not null check (char_length(source_title) between 1 and 500),
  source_type text not null check (source_type in ('official_website', 'official_contact', 'official_pricing', 'official_social', 'official_register', 'tourism_body', 'trade_body', 'reputable_directory', 'internal_record', 'manual_research')),
  source_accessed_at timestamptz not null,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  verification_status text not null default 'unverified' check (verification_status in ('verified', 'likely_valid', 'unverified', 'invalid', 'not_applicable')),
  verification_method text,
  reason text not null check (char_length(reason) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applied', 'rolled_back', 'conflict')),
  conflict_reason text,
  proposal_fingerprint text generated always as (
    md5(
      enrichment_record_id::text || '|' || target_table || '|' || target_field || '|' ||
      coalesce(previous_value, 'null'::jsonb)::text || '|' || proposed_value::text || '|' || source_url
    )
  ) stored,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  applied_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_fingerprint)
);

create table if not exists public.enrichment_email_checks (
  id uuid primary key default gen_random_uuid(),
  enrichment_record_id uuid not null references public.enrichment_records(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  normalized_email text generated always as (lower(btrim(email))) stored,
  syntax_valid boolean not null default false,
  domain text,
  domain_exists boolean,
  has_mx boolean,
  mx_hosts jsonb not null default '[]'::jsonb,
  is_disposable boolean,
  is_role_based boolean,
  known_hard_bounce boolean,
  is_suppressed boolean,
  is_opted_out boolean,
  has_prior_outreach boolean,
  domain_associated boolean,
  status text not null default 'unverified' check (status in ('verified', 'likely_valid', 'unverified', 'invalid', 'hard_bounce', 'suppressed', 'opted_out', 'not_found')),
  verification_method text,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrichment_record_id, normalized_email)
);

create table if not exists public.enrichment_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.enrichment_runs(id) on delete cascade,
  left_entity_type text not null check (left_entity_type in ('venue', 'vendor', 'supplier_application')),
  left_entity_id uuid not null,
  right_entity_type text not null check (right_entity_type in ('venue', 'vendor', 'supplier_application')),
  right_entity_id uuid not null,
  match_reasons jsonb not null default '[]'::jsonb,
  match_score numeric(5, 4) not null check (match_score between 0 and 1),
  canonical_entity_type text check (canonical_entity_type in ('venue', 'vendor', 'supplier_application')),
  canonical_entity_id uuid,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'not_duplicate', 'merged')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, left_entity_type, left_entity_id, right_entity_type, right_entity_id),
  check ((left_entity_type || ':' || left_entity_id::text) < (right_entity_type || ':' || right_entity_id::text)),
  check ((canonical_entity_type is null) = (canonical_entity_id is null)),
  check (
    canonical_entity_id is null or
    (canonical_entity_type = left_entity_type and canonical_entity_id = left_entity_id) or
    (canonical_entity_type = right_entity_type and canonical_entity_id = right_entity_id)
  )
);

create table if not exists public.enrichment_change_log (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.enrichment_field_proposals(id),
  run_id uuid not null references public.enrichment_runs(id),
  enrichment_record_id uuid not null references public.enrichment_records(id),
  action text not null check (action in ('applied', 'rolled_back')),
  target_table text not null check (target_table in ('venues', 'business_enrichment_profiles')),
  target_field text not null,
  previous_value jsonb,
  new_value jsonb,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Existing business fields are often SQL NULL before enrichment. Keep those
-- values distinct from the JSON string "null" while retaining a stable,
-- idempotent proposal fingerprint for staging and replay.
alter table public.enrichment_field_proposals
  alter column previous_value drop not null;

alter table public.enrichment_change_log
  alter column previous_value drop not null,
  alter column new_value drop not null;

do $$
declare
  v_generation_expression text;
begin
  select generation_expression
  into v_generation_expression
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'enrichment_field_proposals'
    and column_name = 'proposal_fingerprint';

  if v_generation_expression is null
     or position('COALESCE' in upper(v_generation_expression)) = 0 then
    alter table public.enrichment_field_proposals
      drop constraint if exists enrichment_field_proposals_proposal_fingerprint_key;
    alter table public.enrichment_field_proposals
      drop column proposal_fingerprint;
    alter table public.enrichment_field_proposals
      add column proposal_fingerprint text generated always as (
        md5(
          enrichment_record_id::text || '|' || target_table || '|' || target_field || '|' ||
          coalesce(previous_value, 'null'::jsonb)::text || '|' || proposed_value::text || '|' || source_url
        )
      ) stored;
    alter table public.enrichment_field_proposals
      add constraint enrichment_field_proposals_proposal_fingerprint_key unique (proposal_fingerprint);
  end if;
end $$;

create index if not exists enrichment_runs_created_by_idx on public.enrichment_runs (created_by);
create index if not exists enrichment_runs_status_created_idx on public.enrichment_runs (status, created_at desc);
create index if not exists enrichment_records_entity_idx on public.enrichment_records (entity_type, entity_id);
create index if not exists enrichment_records_pending_idx
  on public.enrichment_records (run_id, next_attempt_at, created_at)
  where requires_manual_review = false and research_status in ('pending', 'processing', 'failed');
create index if not exists enrichment_field_proposals_record_idx on public.enrichment_field_proposals (enrichment_record_id, created_at);
create index if not exists enrichment_field_proposals_reviewer_idx on public.enrichment_field_proposals (reviewed_by);
create index if not exists enrichment_field_proposals_pending_idx
  on public.enrichment_field_proposals (enrichment_record_id, created_at)
  where status in ('pending', 'approved', 'conflict');
create index if not exists enrichment_email_checks_status_idx on public.enrichment_email_checks (status, checked_at desc);
create index if not exists enrichment_duplicate_candidates_reviewer_idx on public.enrichment_duplicate_candidates (reviewed_by);
create index if not exists enrichment_duplicate_candidates_pending_idx
  on public.enrichment_duplicate_candidates (run_id, match_score desc)
  where status = 'pending';
create index if not exists business_enrichment_profiles_status_idx
  on public.business_enrichment_profiles (business_status, last_verified_at);
create index if not exists enrichment_change_log_proposal_idx on public.enrichment_change_log (proposal_id, created_at desc);
create index if not exists enrichment_change_log_run_idx on public.enrichment_change_log (run_id, created_at desc);
create index if not exists enrichment_change_log_record_idx on public.enrichment_change_log (enrichment_record_id, created_at desc);
create index if not exists enrichment_change_log_changed_by_idx on public.enrichment_change_log (changed_by);

drop trigger if exists enrichment_runs_set_updated_at on public.enrichment_runs;
create trigger enrichment_runs_set_updated_at before update on public.enrichment_runs
for each row execute function public.set_updated_at();
drop trigger if exists enrichment_records_set_updated_at on public.enrichment_records;
create trigger enrichment_records_set_updated_at before update on public.enrichment_records
for each row execute function public.set_updated_at();
drop trigger if exists business_enrichment_profiles_set_updated_at on public.business_enrichment_profiles;
create trigger business_enrichment_profiles_set_updated_at before update on public.business_enrichment_profiles
for each row execute function public.set_updated_at();
drop trigger if exists enrichment_field_proposals_set_updated_at on public.enrichment_field_proposals;
create trigger enrichment_field_proposals_set_updated_at before update on public.enrichment_field_proposals
for each row execute function public.set_updated_at();
drop trigger if exists enrichment_email_checks_set_updated_at on public.enrichment_email_checks;
create trigger enrichment_email_checks_set_updated_at before update on public.enrichment_email_checks
for each row execute function public.set_updated_at();
drop trigger if exists enrichment_duplicate_candidates_set_updated_at on public.enrichment_duplicate_candidates;
create trigger enrichment_duplicate_candidates_set_updated_at before update on public.enrichment_duplicate_candidates
for each row execute function public.set_updated_at();

create or replace function public.reject_enrichment_change_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'enrichment_change_log is append-only';
end;
$$;

drop trigger if exists enrichment_change_log_immutable on public.enrichment_change_log;
create trigger enrichment_change_log_immutable
before update or delete on public.enrichment_change_log
for each row execute function public.reject_enrichment_change_log_mutation();

create or replace function public.apply_enrichment_proposal(
  p_proposal_id uuid,
  p_reviewer_id uuid
)
returns public.enrichment_field_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.enrichment_field_proposals%rowtype;
  v_record public.enrichment_records%rowtype;
  v_current jsonb;
  v_applied jsonb;
begin
  if p_reviewer_id is null or not exists (
    select 1 from public.profiles where id = p_reviewer_id and role = 'admin'
  ) then
    raise exception 'An active admin reviewer is required' using errcode = '42501';
  end if;

  select * into v_proposal
  from public.enrichment_field_proposals
  where id = p_proposal_id
  for update;
  if not found then
    raise exception 'Enrichment proposal not found';
  end if;
  if v_proposal.status = 'applied' then
    return v_proposal;
  end if;
  if v_proposal.status <> 'approved' then
    raise exception 'Only approved enrichment proposals can be applied';
  end if;

  select * into v_record
  from public.enrichment_records
  where id = v_proposal.enrichment_record_id;
  if not found then
    raise exception 'Enrichment record not found';
  end if;

  if v_proposal.target_table = 'venues' then
    if v_record.entity_type <> 'venue' or not (
      v_proposal.target_field = any (array[
        'name', 'type', 'region', 'town', 'country', 'summary', 'description',
        'price_from', 'price_to', 'capacity_min', 'capacity_max',
        'official_website_url', 'official_gallery_url', 'vendor_contact_email',
        'vendor_contact_source_url', 'vendor_contact_verified_at', 'latitude', 'longitude'
      ]::text[])
    ) then
      raise exception 'Target venue field is not allowlisted';
    end if;

    perform 1 from public.venues where id = v_record.entity_id for update;
    if not found then raise exception 'Target venue not found'; end if;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(v.%I), ''null''::jsonb) from public.venues v where v.id = $1',
      v_proposal.target_field
    ) into v_current using v_record.entity_id;
  elsif v_proposal.target_table = 'business_enrichment_profiles' then
    if not (
      v_proposal.target_field = any (array[
        'trading_name', 'contact_page_url', 'enquiry_page_url', 'public_email',
        'enquiries_email', 'wedding_email', 'sales_email', 'phone', 'full_address',
        'address_line_1', 'address_line_2', 'town', 'county_region', 'country',
        'postcode', 'instagram_url', 'facebook_url', 'tiktok_url', 'linkedin_url',
        'services', 'areas_served', 'structured_pricing', 'business_status', 'last_verified_at'
      ]::text[])
    ) then
      raise exception 'Target enrichment profile field is not allowlisted';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('everaft_enrichment_profile:' || v_record.entity_type || ':' || v_record.entity_id::text, 0)
    );
    insert into public.business_enrichment_profiles (entity_type, entity_id)
    values (v_record.entity_type, v_record.entity_id)
    on conflict (entity_type, entity_id) do nothing;
    perform 1 from public.business_enrichment_profiles
      where entity_type = v_record.entity_type and entity_id = v_record.entity_id
      for update;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(p.%I), ''null''::jsonb) from public.business_enrichment_profiles p where p.entity_type = $1 and p.entity_id = $2',
      v_proposal.target_field
    ) into v_current using v_record.entity_type, v_record.entity_id;
  else
    raise exception 'Target table is not allowlisted';
  end if;

  if v_current is distinct from v_proposal.previous_value then
    update public.enrichment_field_proposals
    set status = 'conflict',
        conflict_reason = 'Current value no longer matches the approved previous value.'
    where id = v_proposal.id
    returning * into v_proposal;
    return v_proposal;
  end if;

  if v_proposal.target_table = 'venues' then
    execute pg_catalog.format(
      'update public.venues set %1$I = (pg_catalog.jsonb_populate_record(null::public.venues, pg_catalog.jsonb_build_object(%2$L, $1))).%1$I where id = $2',
      v_proposal.target_field,
      v_proposal.target_field
    ) using v_proposal.proposed_value, v_record.entity_id;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(v.%I), ''null''::jsonb) from public.venues v where v.id = $1',
      v_proposal.target_field
    ) into v_applied using v_record.entity_id;
  else
    execute pg_catalog.format(
      'update public.business_enrichment_profiles set %1$I = (pg_catalog.jsonb_populate_record(null::public.business_enrichment_profiles, pg_catalog.jsonb_build_object(%2$L, $1))).%1$I where entity_type = $2 and entity_id = $3',
      v_proposal.target_field,
      v_proposal.target_field
    ) using v_proposal.proposed_value, v_record.entity_type, v_record.entity_id;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(p.%I), ''null''::jsonb) from public.business_enrichment_profiles p where p.entity_type = $1 and p.entity_id = $2',
      v_proposal.target_field
    ) into v_applied using v_record.entity_type, v_record.entity_id;
  end if;

  insert into public.enrichment_change_log (
    proposal_id, run_id, enrichment_record_id, action, target_table, target_field,
    previous_value, new_value, changed_by
  ) values (
    v_proposal.id, v_record.run_id, v_record.id, 'applied',
    v_proposal.target_table, v_proposal.target_field, v_current, v_applied, p_reviewer_id
  );

  update public.enrichment_field_proposals
  set status = 'applied',
      conflict_reason = null,
      reviewed_by = coalesce(reviewed_by, p_reviewer_id),
      reviewed_at = coalesce(reviewed_at, pg_catalog.now()),
      applied_at = pg_catalog.now()
  where id = v_proposal.id
  returning * into v_proposal;
  return v_proposal;
end;
$$;

comment on function public.apply_enrichment_proposal(uuid, uuid) is
  'Returns the current proposal row. Callers must inspect status: only applied confirms success; conflict means no target business field was changed.';

create or replace function public.rollback_enrichment_proposal(
  p_proposal_id uuid,
  p_reviewer_id uuid
)
returns public.enrichment_field_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.enrichment_field_proposals%rowtype;
  v_record public.enrichment_records%rowtype;
  v_change public.enrichment_change_log%rowtype;
  v_current jsonb;
  v_restored jsonb;
begin
  if p_reviewer_id is null or not exists (
    select 1 from public.profiles where id = p_reviewer_id and role = 'admin'
  ) then
    raise exception 'An active admin reviewer is required' using errcode = '42501';
  end if;

  select * into v_proposal
  from public.enrichment_field_proposals
  where id = p_proposal_id
  for update;
  if not found then raise exception 'Enrichment proposal not found'; end if;
  if v_proposal.status = 'rolled_back' then return v_proposal; end if;
  if v_proposal.status <> 'applied' then
    raise exception 'Only applied enrichment proposals can be rolled back';
  end if;

  select * into v_record from public.enrichment_records where id = v_proposal.enrichment_record_id;
  if not found then raise exception 'Enrichment record not found'; end if;
  select * into v_change
  from public.enrichment_change_log
  where proposal_id = v_proposal.id and action = 'applied'
  order by created_at desc
  limit 1;
  if not found then raise exception 'Applied change log entry not found'; end if;

  if v_proposal.target_table = 'venues' then
    if v_record.entity_type <> 'venue' or not (
      v_proposal.target_field = any (array[
        'name', 'type', 'region', 'town', 'country', 'summary', 'description',
        'price_from', 'price_to', 'capacity_min', 'capacity_max',
        'official_website_url', 'official_gallery_url', 'vendor_contact_email',
        'vendor_contact_source_url', 'vendor_contact_verified_at', 'latitude', 'longitude'
      ]::text[])
    ) then raise exception 'Target venue field is not allowlisted'; end if;
    perform 1 from public.venues where id = v_record.entity_id for update;
    if not found then raise exception 'Target venue not found'; end if;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(v.%I), ''null''::jsonb) from public.venues v where v.id = $1',
      v_proposal.target_field
    ) into v_current using v_record.entity_id;
  elsif v_proposal.target_table = 'business_enrichment_profiles' then
    if not (
      v_proposal.target_field = any (array[
        'trading_name', 'contact_page_url', 'enquiry_page_url', 'public_email',
        'enquiries_email', 'wedding_email', 'sales_email', 'phone', 'full_address',
        'address_line_1', 'address_line_2', 'town', 'county_region', 'country',
        'postcode', 'instagram_url', 'facebook_url', 'tiktok_url', 'linkedin_url',
        'services', 'areas_served', 'structured_pricing', 'business_status', 'last_verified_at'
      ]::text[])
    ) then raise exception 'Target enrichment profile field is not allowlisted'; end if;
    perform 1 from public.business_enrichment_profiles
      where entity_type = v_record.entity_type and entity_id = v_record.entity_id
      for update;
    if not found then raise exception 'Target enrichment profile not found'; end if;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(p.%I), ''null''::jsonb) from public.business_enrichment_profiles p where p.entity_type = $1 and p.entity_id = $2',
      v_proposal.target_field
    ) into v_current using v_record.entity_type, v_record.entity_id;
  else
    raise exception 'Target table is not allowlisted';
  end if;

  if v_current is distinct from v_change.new_value then
    update public.enrichment_field_proposals
    set status = 'conflict',
        conflict_reason = 'Current value changed after enrichment was applied; rollback requires manual review.'
    where id = v_proposal.id
    returning * into v_proposal;
    return v_proposal;
  end if;

  if v_proposal.target_table = 'venues' then
    execute pg_catalog.format(
      'update public.venues set %1$I = (pg_catalog.jsonb_populate_record(null::public.venues, pg_catalog.jsonb_build_object(%2$L, $1))).%1$I where id = $2',
      v_proposal.target_field,
      v_proposal.target_field
    ) using v_change.previous_value, v_record.entity_id;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(v.%I), ''null''::jsonb) from public.venues v where v.id = $1',
      v_proposal.target_field
    ) into v_restored using v_record.entity_id;
  else
    execute pg_catalog.format(
      'update public.business_enrichment_profiles set %1$I = (pg_catalog.jsonb_populate_record(null::public.business_enrichment_profiles, pg_catalog.jsonb_build_object(%2$L, $1))).%1$I where entity_type = $2 and entity_id = $3',
      v_proposal.target_field,
      v_proposal.target_field
    ) using v_change.previous_value, v_record.entity_type, v_record.entity_id;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.to_jsonb(p.%I), ''null''::jsonb) from public.business_enrichment_profiles p where p.entity_type = $1 and p.entity_id = $2',
      v_proposal.target_field
    ) into v_restored using v_record.entity_type, v_record.entity_id;
  end if;

  insert into public.enrichment_change_log (
    proposal_id, run_id, enrichment_record_id, action, target_table, target_field,
    previous_value, new_value, changed_by
  ) values (
    v_proposal.id, v_record.run_id, v_record.id, 'rolled_back',
    v_proposal.target_table, v_proposal.target_field, v_current, v_restored, p_reviewer_id
  );

  update public.enrichment_field_proposals
  set status = 'rolled_back',
      conflict_reason = null,
      rolled_back_at = pg_catalog.now()
  where id = v_proposal.id
  returning * into v_proposal;
  return v_proposal;
end;
$$;

comment on function public.rollback_enrichment_proposal(uuid, uuid) is
  'Returns the current proposal row. Callers must inspect status: only rolled_back confirms success; conflict means no target business field was changed.';

create or replace function public.claim_enrichment_records(
  p_run_id uuid,
  p_worker_id text,
  p_limit integer default 10
)
returns setof public.enrichment_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 100);
begin
  if p_worker_id is null or pg_catalog.char_length(pg_catalog.btrim(p_worker_id)) not between 1 and 120 then
    raise exception 'A worker identifier between 1 and 120 characters is required';
  end if;

  return query
  with picked as (
    select r.id
    from public.enrichment_records r
    where r.run_id = p_run_id
      and r.requires_manual_review = false
      and (r.next_attempt_at is null or r.next_attempt_at <= pg_catalog.now())
      and (r.locked_at is null or r.locked_at < pg_catalog.now() - interval '15 minutes')
      and (
        r.research_status in ('pending', 'failed') or
        (r.research_status = 'processing' and r.locked_at < pg_catalog.now() - interval '15 minutes')
      )
    order by r.created_at, r.id
    limit v_limit
    for update skip locked
  )
  update public.enrichment_records r
  set research_status = 'processing',
      locked_by = pg_catalog.btrim(p_worker_id),
      locked_at = pg_catalog.now(),
      attempt_count = r.attempt_count + 1,
      last_error = null
  from picked
  where r.id = picked.id
  returning r.*;
end;
$$;

alter table public.enrichment_runs enable row level security;
alter table public.enrichment_records enable row level security;
alter table public.business_enrichment_profiles enable row level security;
alter table public.enrichment_field_proposals enable row level security;
alter table public.enrichment_email_checks enable row level security;
alter table public.enrichment_duplicate_candidates enable row level security;
alter table public.enrichment_change_log enable row level security;

revoke all on public.enrichment_runs from anon, authenticated;
revoke all on public.enrichment_records from anon, authenticated;
revoke all on public.business_enrichment_profiles from anon, authenticated;
revoke all on public.enrichment_field_proposals from anon, authenticated;
revoke all on public.enrichment_email_checks from anon, authenticated;
revoke all on public.enrichment_duplicate_candidates from anon, authenticated;
revoke all on public.enrichment_change_log from anon, authenticated;

grant usage on schema public to service_role;
grant select on table
  public.venues,
  public.venue_amenities,
  public.supplier_applications,
  public.outreach_suppressions,
  public.outreach_campaign_recipients
to service_role;
grant select, insert, update, delete on table
  public.enrichment_runs,
  public.enrichment_records,
  public.business_enrichment_profiles,
  public.enrichment_field_proposals,
  public.enrichment_email_checks,
  public.enrichment_duplicate_candidates
to service_role;
grant select on table public.enrichment_change_log to service_role;

revoke execute on function public.reject_enrichment_change_log_mutation() from public, anon, authenticated;
revoke execute on function public.apply_enrichment_proposal(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.rollback_enrichment_proposal(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.claim_enrichment_records(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.apply_enrichment_proposal(uuid, uuid) to service_role;
grant execute on function public.rollback_enrichment_proposal(uuid, uuid) to service_role;
grant execute on function public.claim_enrichment_records(uuid, text, integer) to service_role;

notify pgrst, 'reload schema';

-- Phase 11: verified, source-backed venue pricing.
--
-- Run after supabase/phase10_enrichment_workflow.sql. Public clients may only
-- read published price options belonging to venues that are themselves public.
-- Claimed venue owners may submit and edit their own venue-confirmed drafts,
-- but only an admin or service_role workflow can publish them.

do $$
begin
  create type public.venue_price_kind as enum (
    'venue_hire',
    'exclusive_use',
    'wedding_package',
    'per_person',
    'ceremony_fee',
    'catering',
    'accommodation',
    'minimum_spend',
    'quote_required',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.venue_price_unit as enum (
    'total',
    'per_person',
    'per_night',
    'per_room',
    'per_event',
    'per_hour',
    'unspecified',
    'quote'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.venue_price_status as enum ('draft', 'published', 'superseded');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.venue_price_source_type as enum (
    'official_website',
    'official_brochure',
    'venue_confirmed',
    'admin_verified',
    'legacy_import',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.venue_price_verification_method as enum (
    'official_source',
    'venue_confirmation',
    'admin_review'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.venue_price_options (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  kind public.venue_price_kind not null,
  label text not null check (char_length(btrim(label)) between 1 and 160),
  amount_from_pence bigint,
  amount_to_pence bigint,
  currency text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  pricing_unit public.venue_price_unit not null default 'total',
  included_guests integer check (included_guests is null or included_guests > 0),
  season_label text check (season_label is null or char_length(btrim(season_label)) between 1 and 120),
  day_label text check (day_label is null or char_length(btrim(day_label)) between 1 and 120),
  description text check (description is null or char_length(description) <= 4000),
  source_type public.venue_price_source_type not null,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  source_title text check (source_title is null or char_length(btrim(source_title)) between 1 and 300),
  evidence_text text check (evidence_text is null or char_length(evidence_text) <= 4000),
  source_fingerprint text unique,
  valid_from date,
  valid_to date,
  last_checked_at timestamptz,
  verification_method public.venue_price_verification_method,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  status public.venue_price_status not null default 'draft',
  published_at timestamptz,
  superseded_at timestamptz,
  superseded_by uuid references public.venue_price_options(id) on delete set null,
  display_priority integer not null default 100 check (display_priority between 0 and 10000),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_price_options_amounts_check check (
    (
      kind = 'quote_required'
      and pricing_unit = 'quote'
      and amount_from_pence is null
      and amount_to_pence is null
    )
    or
    (
      kind <> 'quote_required'
      and pricing_unit <> 'quote'
      and amount_from_pence is not null
      and amount_from_pence > 0
      and (amount_to_pence is null or amount_to_pence >= amount_from_pence)
    )
  ),
  constraint venue_price_options_validity_check check (
    valid_from is null or valid_to is null or valid_to >= valid_from
  ),
  constraint venue_price_options_source_check check (
    source_type not in ('official_website', 'official_brochure') or source_url is not null
  ),
  constraint venue_price_options_lifecycle_check check (
    (
      status = 'draft'
      and published_at is null
      and superseded_at is null
      and superseded_by is null
    )
    or
    (
      status = 'published'
      and published_at is not null
      and superseded_at is null
      and superseded_by is null
      and verified_at is not null
      and last_checked_at is not null
      and verification_method is not null
    )
    or
    (
      status = 'superseded'
      and published_at is not null
      and superseded_at is not null
      and verified_at is not null
      and last_checked_at is not null
      and verification_method is not null
    )
  ),
  constraint venue_price_options_supersession_check check (
    superseded_by is null or superseded_by <> id
  )
);

comment on table public.venue_price_options is
  'Source-backed venue pricing. Draft research and vendor submissions are private; only verified published rows for public venues are publicly readable.';
comment on column public.venue_price_options.amount_from_pence is
  'Lower or starting amount in minor currency units. Null only for quote-required pricing.';
comment on column public.venue_price_options.amount_to_pence is
  'Optional upper amount in minor currency units; must not be lower than amount_from_pence.';
comment on column public.venue_price_options.evidence_text is
  'Short evidence excerpt for review, not a place to store an entire copyrighted page or brochure.';

create index if not exists venue_price_options_public_idx
  on public.venue_price_options (venue_id, display_priority, amount_from_pence)
  where status = 'published';
create index if not exists venue_price_options_venue_id_idx
  on public.venue_price_options (venue_id);
create index if not exists venue_price_options_review_idx
  on public.venue_price_options (status, last_checked_at, updated_at desc);
create index if not exists venue_price_options_source_idx
  on public.venue_price_options (source_type, status);
create index if not exists venue_price_options_verified_by_idx
  on public.venue_price_options (verified_by)
  where verified_by is not null;
create index if not exists venue_price_options_created_by_idx
  on public.venue_price_options (created_by)
  where created_by is not null;
create index if not exists venue_price_options_updated_by_idx
  on public.venue_price_options (updated_by)
  where updated_by is not null;
create index if not exists venue_price_options_superseded_by_idx
  on public.venue_price_options (superseded_by)
  where superseded_by is not null;

drop trigger if exists venue_price_options_set_updated_at on public.venue_price_options;
create trigger venue_price_options_set_updated_at
before update on public.venue_price_options
for each row execute function public.set_updated_at();

alter table public.venue_price_options enable row level security;

revoke all on public.venue_price_options from public, anon, authenticated;
grant select on public.venue_price_options to anon, authenticated;
grant insert, update on public.venue_price_options to authenticated;
grant select, insert, update, delete on public.venue_price_options to service_role;

drop policy if exists "Published venue prices are public" on public.venue_price_options;
drop policy if exists "Admins manage venue prices" on public.venue_price_options;
drop policy if exists "Claimed owners read venue prices" on public.venue_price_options;
drop policy if exists "Claimed owners create venue price drafts" on public.venue_price_options;
drop policy if exists "Claimed owners update own venue price drafts" on public.venue_price_options;

create policy "Published venue prices are public"
on public.venue_price_options
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.venues
    where venues.id = venue_price_options.venue_id
      and venues.status = 'published'
      and venues.listing_status in ('published', 'claimed')
  )
);

create policy "Admins manage venue prices"
on public.venue_price_options
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Claimed owners read venue prices"
on public.venue_price_options
for select
to authenticated
using (
  exists (
    select 1
    from public.venues
    where venues.id = venue_price_options.venue_id
      and venues.is_claimed = true
      and venues.claim_status = 'approved'
      and venues.claimed_by = (select auth.uid())
  )
);

create policy "Claimed owners create venue price drafts"
on public.venue_price_options
for insert
to authenticated
with check (
  status = 'draft'
  and source_type = 'venue_confirmed'
  and verification_method is null
  and verified_at is null
  and verified_by is null
  and published_at is null
  and superseded_at is null
  and superseded_by is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and exists (
    select 1
    from public.venues
    where venues.id = venue_price_options.venue_id
      and venues.is_claimed = true
      and venues.claim_status = 'approved'
      and venues.claimed_by = (select auth.uid())
  )
);

create policy "Claimed owners update own venue price drafts"
on public.venue_price_options
for update
to authenticated
using (
  status = 'draft'
  and source_type = 'venue_confirmed'
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.venues
    where venues.id = venue_price_options.venue_id
      and venues.is_claimed = true
      and venues.claim_status = 'approved'
      and venues.claimed_by = (select auth.uid())
  )
)
with check (
  status = 'draft'
  and source_type = 'venue_confirmed'
  and verification_method is null
  and verified_at is null
  and verified_by is null
  and published_at is null
  and superseded_at is null
  and superseded_by is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and exists (
    select 1
    from public.venues
    where venues.id = venue_price_options.venue_id
      and venues.is_claimed = true
      and venues.claim_status = 'approved'
      and venues.claimed_by = (select auth.uid())
  )
);

-- Preserve the site's existing numeric pricing as private review material.
-- Some legacy summary prices are known to be stale, so neither these values nor
-- any enrichment proposal or scraped snippet is auto-published by this migration.
insert into public.venue_price_options (
  venue_id,
  kind,
  label,
  amount_from_pence,
  amount_to_pence,
  currency,
  pricing_unit,
  source_type,
  evidence_text,
  source_fingerprint,
  status,
  display_priority
)
select
  venues.id,
  'other'::public.venue_price_kind,
  'Indicative venue price',
  coalesce(venues.price_from, venues.price_to)::bigint * 100,
  case
    when venues.price_from is not null
      and venues.price_to is not null
      and venues.price_to > venues.price_from
      then venues.price_to::bigint * 100
    else null
  end,
  'GBP',
  'total'::public.venue_price_unit,
  'legacy_import'::public.venue_price_source_type,
  'Unverified legacy value imported from venues.price_from and venues.price_to for source review. It must not be published without current official evidence.',
  'legacy_numeric:' || venues.id::text,
  'draft'::public.venue_price_status,
  100
from public.venues
where venues.price_from is not null or venues.price_to is not null
on conflict (source_fingerprint) do nothing;

notify pgrst, 'reload schema';

-- Phase 12: consolidate pricing RLS policies so each role/action evaluates one
-- permissive policy. This preserves the Phase 11 access model while avoiding
-- repeated policy evaluation on public and owner pricing reads/writes.

alter type public.venue_price_unit add value if not exists 'per_hour';
alter type public.venue_price_unit add value if not exists 'unspecified';

revoke all on public.venue_price_options from public, anon, authenticated;
grant select on public.venue_price_options to anon;
grant select, insert, update, delete on public.venue_price_options to authenticated;
grant select, insert, update, delete on public.venue_price_options to service_role;

drop policy if exists "Published venue prices are public" on public.venue_price_options;
drop policy if exists "Admins manage venue prices" on public.venue_price_options;
drop policy if exists "Claimed owners read venue prices" on public.venue_price_options;
drop policy if exists "Claimed owners create venue price drafts" on public.venue_price_options;
drop policy if exists "Claimed owners update own venue price drafts" on public.venue_price_options;
drop policy if exists "Authenticated users read allowed venue prices" on public.venue_price_options;
drop policy if exists "Authenticated users create allowed venue prices" on public.venue_price_options;
drop policy if exists "Authenticated users update allowed venue prices" on public.venue_price_options;
drop policy if exists "Admins delete venue prices" on public.venue_price_options;

create policy "Published venue prices are public"
on public.venue_price_options
for select
to anon
using (
  status = 'published'
  and exists (
    select 1
    from public.venues
    where venues.id = venue_price_options.venue_id
      and venues.status = 'published'
      and venues.listing_status in ('published', 'claimed')
  )
);

create policy "Authenticated users read allowed venue prices"
on public.venue_price_options
for select
to authenticated
using (
  (
    status = 'published'
    and exists (
      select 1
      from public.venues
      where venues.id = venue_price_options.venue_id
        and venues.status = 'published'
        and venues.listing_status in ('published', 'claimed')
    )
  )
  or (select public.is_admin())
  or exists (
    select 1
    from public.venues
    where venues.id = venue_price_options.venue_id
      and venues.is_claimed = true
      and venues.claim_status = 'approved'
      and venues.claimed_by = (select auth.uid())
  )
);

create policy "Authenticated users create allowed venue prices"
on public.venue_price_options
for insert
to authenticated
with check (
  (select public.is_admin())
  or (
    status = 'draft'
    and source_type = 'venue_confirmed'
    and verification_method is null
    and verified_at is null
    and verified_by is null
    and published_at is null
    and superseded_at is null
    and superseded_by is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and exists (
      select 1
      from public.venues
      where venues.id = venue_price_options.venue_id
        and venues.is_claimed = true
        and venues.claim_status = 'approved'
        and venues.claimed_by = (select auth.uid())
    )
  )
);

create policy "Authenticated users update allowed venue prices"
on public.venue_price_options
for update
to authenticated
using (
  (select public.is_admin())
  or (
    status = 'draft'
    and source_type = 'venue_confirmed'
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.venues
      where venues.id = venue_price_options.venue_id
        and venues.is_claimed = true
        and venues.claim_status = 'approved'
        and venues.claimed_by = (select auth.uid())
    )
  )
)
with check (
  (select public.is_admin())
  or (
    status = 'draft'
    and source_type = 'venue_confirmed'
    and verification_method is null
    and verified_at is null
    and verified_by is null
    and published_at is null
    and superseded_at is null
    and superseded_by is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and exists (
      select 1
      from public.venues
      where venues.id = venue_price_options.venue_id
        and venues.is_claimed = true
        and venues.claim_status = 'approved'
        and venues.claimed_by = (select auth.uid())
    )
  )
);

create policy "Admins delete venue prices"
on public.venue_price_options
for delete
to authenticated
using ((select public.is_admin()));

notify pgrst, 'reload schema';

-- Phase 13: preserve material pricing context alongside each published amount.
--
-- Tax treatment and minimum-stay rules can materially change the real cost of
-- a wedding price. Keeping them structured prevents a base amount from being
-- presented or imported into the budget planner without its qualifier.

do $$
begin
  create type public.venue_price_qualifier as enum ('from', 'fixed', 'range', 'quote');
exception
  when duplicate_object then null;
end $$;

alter table public.venue_price_options
  add column if not exists tax_label text,
  add column if not exists minimum_nights integer,
  add column if not exists price_qualifier public.venue_price_qualifier;

-- An equal upper amount carries no range information. Normalise any legacy
-- occurrence before enforcing the structured qualifier relationship.
update public.venue_price_options
set amount_to_pence = null
where amount_to_pence = amount_from_pence;

update public.venue_price_options
set price_qualifier = case
  when kind = 'quote_required' or pricing_unit = 'quote' then 'quote'::public.venue_price_qualifier
  when amount_to_pence is not null and amount_to_pence > amount_from_pence then 'range'::public.venue_price_qualifier
  else 'from'::public.venue_price_qualifier
end
where price_qualifier is null;

alter table public.venue_price_options
  alter column price_qualifier set default 'from'::public.venue_price_qualifier,
  alter column price_qualifier set not null;

alter table public.venue_price_options
  drop constraint if exists venue_price_options_tax_label_check,
  add constraint venue_price_options_tax_label_check check (
    tax_label is null or char_length(btrim(tax_label)) between 1 and 80
  ),
  drop constraint if exists venue_price_options_minimum_nights_check,
  add constraint venue_price_options_minimum_nights_check check (
    minimum_nights is null or minimum_nights between 1 and 365
  ),
  drop constraint if exists venue_price_options_published_evidence_check,
  add constraint venue_price_options_published_evidence_check check (
    status = 'draft' or (evidence_text is not null and btrim(evidence_text) <> '')
  ),
  drop constraint if exists venue_price_options_qualifier_check,
  add constraint venue_price_options_qualifier_check check (
    (
      kind = 'quote_required'
      and pricing_unit = 'quote'
      and price_qualifier = 'quote'
      and amount_from_pence is null
      and amount_to_pence is null
    )
    or
    (
      kind <> 'quote_required'
      and pricing_unit <> 'quote'
      and amount_from_pence is not null
      and (
        (price_qualifier = 'range' and amount_to_pence is not null and amount_to_pence > amount_from_pence)
        or (price_qualifier in ('from', 'fixed') and amount_to_pence is null)
      )
    )
  );

comment on column public.venue_price_options.tax_label is
  'Material tax qualifier shown with the amount, for example VAT included or VAT additional.';
comment on column public.venue_price_options.minimum_nights is
  'Minimum number of nights attached to the published price or package.';
comment on column public.venue_price_options.price_qualifier is
  'Controls whether a numeric amount is presented as from, fixed or a range; quote is reserved for quote-required rows.';

-- Expired prices must not be returned by public reads. Admins and approved
-- claimed owners retain access through the private branches of the
-- authenticated policy so they can review and replace historical prices.
drop policy if exists "Published venue prices are public" on public.venue_price_options;
drop policy if exists "Authenticated users read allowed venue prices" on public.venue_price_options;

create policy "Published venue prices are public"
on public.venue_price_options
for select
to anon
using (
  status = 'published'
  and (valid_to is null or valid_to >= current_date)
  and exists (
    select 1
    from public.venues
    where venues.id = venue_price_options.venue_id
      and venues.status = 'published'
      and venues.listing_status in ('published', 'claimed')
  )
);

create policy "Authenticated users read allowed venue prices"
on public.venue_price_options
for select
to authenticated
using (
  (
    status = 'published'
    and (valid_to is null or valid_to >= current_date)
    and exists (
      select 1
      from public.venues
      where venues.id = venue_price_options.venue_id
        and venues.status = 'published'
        and venues.listing_status in ('published', 'claimed')
    )
  )
  or (select public.is_admin())
  or exists (
    select 1
    from public.venues
    where venues.id = venue_price_options.venue_id
      and venues.is_claimed = true
      and venues.claim_status = 'approved'
      and venues.claimed_by = (select auth.uid())
  )
);

notify pgrst, 'reload schema';
