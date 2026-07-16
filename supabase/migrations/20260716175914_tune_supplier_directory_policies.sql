-- Keep public SELECT policies separate from administrator writes so Postgres
-- evaluates only one permissive policy for ordinary directory reads.

alter function public.set_updated_at() set search_path = '';

create index if not exists supplier_listings_vendor_idx
  on public.supplier_listings (vendor_id)
  where vendor_id is not null;
create index if not exists supplier_listings_reviewer_idx
  on public.supplier_listings (reviewed_by)
  where reviewed_by is not null;
create index if not exists supplier_venue_connections_reviewer_idx
  on public.supplier_venue_connections (verified_by)
  where verified_by is not null;
create index if not exists supplier_favourites_supplier_idx
  on public.supplier_favourites (supplier_id);

drop policy if exists "Admins manage supplier categories" on public.supplier_categories;
create policy "Admins insert supplier categories"
  on public.supplier_categories for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins update supplier categories"
  on public.supplier_categories for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins delete supplier categories"
  on public.supplier_categories for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins manage supplier listings" on public.supplier_listings;
create policy "Admins insert supplier listings"
  on public.supplier_listings for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins update supplier listings"
  on public.supplier_listings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins delete supplier listings"
  on public.supplier_listings for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins manage photographer profiles" on public.photographer_profiles;
create policy "Admins insert photographer profiles"
  on public.photographer_profiles for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins update photographer profiles"
  on public.photographer_profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins delete photographer profiles"
  on public.photographer_profiles for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins manage supplier images" on public.supplier_images;
create policy "Admins insert supplier images"
  on public.supplier_images for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins update supplier images"
  on public.supplier_images for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins delete supplier images"
  on public.supplier_images for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Verified supplier venue connections are public" on public.supplier_venue_connections;
create policy "Verified supplier venue connections are public"
  on public.supplier_venue_connections for select
  using (
    (
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
    )
    or (select public.is_admin())
  );

drop policy if exists "Admins manage supplier venue connections" on public.supplier_venue_connections;
create policy "Admins insert supplier venue connections"
  on public.supplier_venue_connections for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins update supplier venue connections"
  on public.supplier_venue_connections for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins delete supplier venue connections"
  on public.supplier_venue_connections for delete to authenticated
  using ((select public.is_admin()));

notify pgrst, 'reload schema';
