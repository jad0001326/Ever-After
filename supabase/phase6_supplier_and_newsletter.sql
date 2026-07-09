-- Phase 6: supplier acquisition and double-opt-in newsletter.
-- Apply after supabase/schema.sql. Writes are intentionally server-only via
-- SUPABASE_SERVICE_ROLE_KEY; never expose that key to the browser.

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

-- There are intentionally no public policies. All writes happen through
-- authenticated server code using the service-role key, after validation,
-- honeypot, and rate-limit checks.
revoke all on public.supplier_applications from anon, authenticated;
revoke all on public.newsletter_subscribers from anon, authenticated;

notify pgrst, 'reload schema';
