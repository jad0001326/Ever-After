create index if not exists vendor_update_requests_venue_idx
  on public.vendor_update_requests (venue_id);

create index if not exists vendor_update_requests_vendor_user_idx
  on public.vendor_update_requests (vendor_user_id);

create index if not exists vendor_update_requests_reviewer_idx
  on public.vendor_update_requests (reviewed_by)
  where reviewed_by is not null;

drop policy if exists "Vendor users create update requests" on public.vendor_update_requests;
drop policy if exists "Vendor users read own update requests" on public.vendor_update_requests;
drop policy if exists "Admins manage vendor update requests" on public.vendor_update_requests;
drop policy if exists "Vendor users and admins read update requests" on public.vendor_update_requests;
drop policy if exists "Admins update vendor update requests" on public.vendor_update_requests;
drop policy if exists "Admins delete vendor update requests" on public.vendor_update_requests;

create policy "Vendor users create update requests"
on public.vendor_update_requests
for insert
to authenticated
with check (
  vendor_user_id = (select auth.uid())
  and exists (
    select 1
    from public.venues
    where venues.id = vendor_update_requests.venue_id
      and venues.claimed_by = (select auth.uid())
      and venues.is_claimed = true
      and venues.claim_status = 'approved'
  )
);

create policy "Vendor users and admins read update requests"
on public.vendor_update_requests
for select
to authenticated
using (
  vendor_user_id = (select auth.uid())
  or (select public.is_admin())
);

create policy "Admins update vendor update requests"
on public.vendor_update_requests
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins delete vendor update requests"
on public.vendor_update_requests
for delete
to authenticated
using ((select public.is_admin()));

notify pgrst, 'reload schema';
