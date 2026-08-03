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
