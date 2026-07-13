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
