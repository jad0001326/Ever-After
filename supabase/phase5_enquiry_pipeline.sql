-- Phase 5 enquiry pipeline patch.
-- Adds the converted lead state, lead update timestamps, and vendor access policies.

alter type public.enquiry_status add value if not exists 'converted';

alter table public.enquiries
  add column if not exists updated_at timestamptz not null default now();

create index if not exists enquiries_status_created_idx
  on public.enquiries (status, created_at desc);

drop trigger if exists enquiries_set_updated_at on public.enquiries;
create trigger enquiries_set_updated_at
before update on public.enquiries
for each row execute function public.set_updated_at();

drop policy if exists "Vendor users read venue enquiries" on public.enquiries;
drop policy if exists "Vendor users update venue enquiries" on public.enquiries;

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

notify pgrst, 'reload schema';
