-- Reusable public supplier directory foundation. Photographers are the first
-- live category; the core listing model is intentionally category-neutral.

create table if not exists public.supplier_categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  plural_name text not null,
  description text not null default '',
  budget_category_id text,
  sort_order integer not null default 100,
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.supplier_categories (slug, name, plural_name, description, budget_category_id, sort_order, is_live)
values
  ('photographer', 'Photographer', 'Photographers', 'Wedding photographers covering celebrations across Scotland.', 'photography', 10, true),
  ('videographer', 'Videographer', 'Videographers', 'Wedding filmmakers and videographers.', 'videography', 20, false),
  ('celebrant', 'Celebrant', 'Celebrants', 'Independent wedding celebrants.', 'registrar-celebrant', 30, false),
  ('florist', 'Florist', 'Florists', 'Wedding florists and floral designers.', 'flowers', 40, false),
  ('wedding-planner', 'Wedding planner', 'Wedding planners', 'Wedding planners and on-the-day coordinators.', 'miscellaneous', 50, false),
  ('band-musician', 'Band or musician', 'Bands and musicians', 'Live wedding bands and musicians.', 'dj-band', 60, false),
  ('dj', 'DJ', 'DJs', 'Wedding DJs and evening entertainment.', 'dj-band', 70, false),
  ('caterer', 'Caterer', 'Caterers', 'Wedding caterers and private dining teams.', 'catering', 80, false),
  ('cake-maker', 'Cake maker', 'Cake makers', 'Wedding cake designers and bakers.', 'cake', 90, false),
  ('styling-decor', 'Styling and decor', 'Stylists and decor suppliers', 'Wedding styling, decor and prop hire.', 'decor', 100, false),
  ('transport', 'Transport', 'Transport suppliers', 'Wedding cars, coaches and specialist transport.', 'transport', 110, false),
  ('bridal-boutique', 'Bridal boutique', 'Bridal boutiques', 'Bridalwear boutiques and designers.', 'wedding-dress', 120, false),
  ('hair-makeup', 'Hair and makeup', 'Hair and makeup artists', 'Wedding hair and makeup professionals.', 'hair-makeup', 130, false),
  ('stationery', 'Stationery', 'Stationers', 'Wedding stationery designers and makers.', 'stationery', 140, false),
  ('entertainment', 'Entertainment', 'Entertainment suppliers', 'Wedding entertainment and guest experiences.', 'entertainment', 150, false),
  ('jeweller', 'Jeweller', 'Jewellers', 'Wedding and engagement ring specialists.', 'rings', 160, false)
on conflict (slug) do update set
  name = excluded.name,
  plural_name = excluded.plural_name,
  description = excluded.description,
  budget_category_id = excluded.budget_category_id,
  sort_order = excluded.sort_order;

create table if not exists public.supplier_listings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id) on delete set null,
  application_id uuid unique references public.supplier_applications(id) on delete set null,
  category_slug text not null references public.supplier_categories(slug) on update cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  base_town text not null check (char_length(btrim(base_town)) between 1 and 120),
  region text not null check (char_length(btrim(region)) between 1 and 120),
  country text not null default 'Scotland' check (char_length(btrim(country)) between 1 and 120),
  service_areas text[] not null default '{}',
  travel_radius_miles integer check (travel_radius_miles is null or travel_radius_miles between 0 and 1000),
  travels_nationwide boolean not null default false,
  summary text not null default '' check (char_length(summary) <= 500),
  description text not null default '' check (char_length(description) <= 5000),
  services text[] not null default '{}',
  official_website_url text,
  instagram_url text,
  facebook_url text,
  enquiry_url text,
  source_url text,
  starting_price_pence integer check (starting_price_pence is null or starting_price_pence >= 0),
  typical_price_pence integer check (typical_price_pence is null or typical_price_pence >= 0),
  pricing_summary text check (pricing_summary is null or char_length(pricing_summary) <= 1000),
  pricing_unit text not null default 'package' check (pricing_unit in ('package', 'hour', 'person', 'item', 'event', 'quote')),
  hero_image_url text,
  image_credit text check (image_credit is null or char_length(image_credit) <= 240),
  image_permission_status text not null default 'representative' check (image_permission_status in ('representative', 'pending', 'approved', 'rejected')),
  listing_status text not null default 'draft' check (listing_status in ('draft', 'published', 'archived')),
  claim_status text not null default 'unclaimed' check (claim_status in ('unclaimed', 'pending', 'approved', 'rejected')),
  is_claimed boolean not null default false,
  is_featured boolean not null default false,
  published_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_listings_published_content_check check (
    listing_status <> 'published'
    or (
      char_length(btrim(summary)) >= 40
      and char_length(btrim(description)) >= 80
      and official_website_url is not null
    )
  ),
  constraint supplier_listings_price_order_check check (
    typical_price_pence is null
    or starting_price_pence is null
    or typical_price_pence >= starting_price_pence
  ),
  constraint supplier_listings_image_permission_check check (
    hero_image_url is null or image_permission_status = 'approved'
  )
);

comment on table public.supplier_listings is
  'Public wedding supplier profiles. Contact emails stay in protected application/vendor records and are not exposed here.';

create table if not exists public.photographer_profiles (
  supplier_id uuid primary key references public.supplier_listings(id) on delete cascade,
  styles text[] not null default '{}',
  coverage_hours_min numeric(4, 1) check (coverage_hours_min is null or coverage_hours_min > 0),
  coverage_hours_max numeric(4, 1) check (coverage_hours_max is null or coverage_hours_max >= coverage_hours_min),
  second_photographer_available boolean,
  engagement_shoot_available boolean,
  drone_available boolean,
  film_photography_available boolean,
  albums_available boolean,
  turnaround_weeks_min integer check (turnaround_weeks_min is null or turnaround_weeks_min between 0 and 104),
  turnaround_weeks_max integer check (turnaround_weeks_max is null or turnaround_weeks_max between 0 and 104),
  updated_at timestamptz not null default now(),
  constraint photographer_profiles_turnaround_order_check check (
    turnaround_weeks_max is null
    or turnaround_weeks_min is null
    or turnaround_weeks_max >= turnaround_weeks_min
  )
);

create table if not exists public.supplier_images (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_listings(id) on delete cascade,
  url text not null,
  alt text not null check (char_length(btrim(alt)) between 3 and 300),
  credit_text text check (credit_text is null or char_length(credit_text) <= 240),
  permission_status text not null default 'pending' check (permission_status in ('pending', 'approved', 'rejected')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_venue_connections (
  supplier_id uuid not null references public.supplier_listings(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  connection_type text not null default 'worked_at' check (connection_type in ('worked_at', 'preferred_supplier', 'recommended')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  source_url text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (supplier_id, venue_id, connection_type)
);

create table if not exists public.supplier_favourites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  supplier_id uuid not null references public.supplier_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, supplier_id)
);

create index if not exists supplier_listings_category_status_idx
  on public.supplier_listings (category_slug, listing_status, is_featured desc, name);
create index if not exists supplier_listings_location_idx
  on public.supplier_listings (region, base_town);
create index if not exists supplier_listings_price_idx
  on public.supplier_listings (category_slug, starting_price_pence)
  where listing_status = 'published';
create index if not exists supplier_listings_search_idx
  on public.supplier_listings using gin (
    to_tsvector(
      'english',
      name || ' ' || base_town || ' ' || region || ' ' || summary
    )
  );
create index if not exists supplier_listings_service_areas_idx
  on public.supplier_listings using gin (service_areas);
create index if not exists supplier_listings_services_idx
  on public.supplier_listings using gin (services);
create index if not exists photographer_profiles_styles_idx
  on public.photographer_profiles using gin (styles);
create index if not exists supplier_images_supplier_sort_idx
  on public.supplier_images (supplier_id, sort_order);
create index if not exists supplier_venue_connections_venue_idx
  on public.supplier_venue_connections (venue_id, status);
create index if not exists supplier_favourites_user_idx
  on public.supplier_favourites (user_id, created_at desc);

drop trigger if exists supplier_categories_set_updated_at on public.supplier_categories;
create trigger supplier_categories_set_updated_at
before update on public.supplier_categories
for each row execute function public.set_updated_at();

drop trigger if exists supplier_listings_set_updated_at on public.supplier_listings;
create trigger supplier_listings_set_updated_at
before update on public.supplier_listings
for each row execute function public.set_updated_at();

drop trigger if exists photographer_profiles_set_updated_at on public.photographer_profiles;
create trigger photographer_profiles_set_updated_at
before update on public.photographer_profiles
for each row execute function public.set_updated_at();

alter table public.supplier_categories enable row level security;
alter table public.supplier_listings enable row level security;
alter table public.photographer_profiles enable row level security;
alter table public.supplier_images enable row level security;
alter table public.supplier_venue_connections enable row level security;
alter table public.supplier_favourites enable row level security;

grant select on public.supplier_categories to anon, authenticated;
grant select on public.supplier_listings to anon, authenticated;
grant select on public.photographer_profiles to anon, authenticated;
grant select on public.supplier_images to anon, authenticated;
grant select on public.supplier_venue_connections to anon, authenticated;
grant select, insert, delete on public.supplier_favourites to authenticated;

grant insert, update, delete on public.supplier_categories to authenticated;
grant insert, update, delete on public.supplier_listings to authenticated;
grant insert, update, delete on public.photographer_profiles to authenticated;
grant insert, update, delete on public.supplier_images to authenticated;
grant insert, update, delete on public.supplier_venue_connections to authenticated;

drop policy if exists "Live supplier categories are public" on public.supplier_categories;
drop policy if exists "Admins manage supplier categories" on public.supplier_categories;
create policy "Live supplier categories are public"
  on public.supplier_categories for select
  using (is_live or (select public.is_admin()));
create policy "Admins manage supplier categories"
  on public.supplier_categories for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Published supplier listings are public" on public.supplier_listings;
drop policy if exists "Admins manage supplier listings" on public.supplier_listings;
create policy "Published supplier listings are public"
  on public.supplier_listings for select
  using (listing_status = 'published' or (select public.is_admin()));
create policy "Admins manage supplier listings"
  on public.supplier_listings for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Published photographer profiles are public" on public.photographer_profiles;
drop policy if exists "Admins manage photographer profiles" on public.photographer_profiles;
create policy "Published photographer profiles are public"
  on public.photographer_profiles for select
  using (
    exists (
      select 1 from public.supplier_listings
      where supplier_listings.id = photographer_profiles.supplier_id
        and supplier_listings.listing_status = 'published'
    )
    or (select public.is_admin())
  );
create policy "Admins manage photographer profiles"
  on public.photographer_profiles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Approved supplier images are public" on public.supplier_images;
drop policy if exists "Admins manage supplier images" on public.supplier_images;
create policy "Approved supplier images are public"
  on public.supplier_images for select
  using (
    (
      permission_status = 'approved'
      and exists (
        select 1 from public.supplier_listings
        where supplier_listings.id = supplier_images.supplier_id
          and supplier_listings.listing_status = 'published'
      )
    )
    or (select public.is_admin())
  );
create policy "Admins manage supplier images"
  on public.supplier_images for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Verified supplier venue connections are public" on public.supplier_venue_connections;
drop policy if exists "Admins manage supplier venue connections" on public.supplier_venue_connections;
create policy "Verified supplier venue connections are public"
  on public.supplier_venue_connections for select
  using (
    status = 'verified'
    and exists (
      select 1 from public.supplier_listings
      where supplier_listings.id = supplier_venue_connections.supplier_id
        and supplier_listings.listing_status = 'published'
    )
    and exists (
      select 1 from public.venues
      where venues.id = supplier_venue_connections.venue_id
        and venues.status = 'published'
        and venues.listing_status in ('published', 'claimed')
    )
  );
create policy "Admins manage supplier venue connections"
  on public.supplier_venue_connections for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Users manage own supplier favourites" on public.supplier_favourites;
create policy "Users manage own supplier favourites"
  on public.supplier_favourites for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
