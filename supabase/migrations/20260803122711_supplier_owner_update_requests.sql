-- Reviewable supplier-owner self-service. Claimed supplier members can submit
-- bounded profile proposals, while only an administrator can atomically apply
-- them to the public listing.

create table if not exists public.supplier_update_requests (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_listings(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  proposed_base_town text not null check (char_length(btrim(proposed_base_town)) between 1 and 120),
  proposed_region text not null check (char_length(btrim(proposed_region)) between 1 and 120),
  proposed_service_areas text[] not null default '{}'::text[] check (cardinality(proposed_service_areas) <= 50 and char_length(array_to_string(proposed_service_areas, ',')) <= 4000),
  proposed_travels_nationwide boolean not null default false,
  proposed_summary text not null check (char_length(btrim(proposed_summary)) between 20 and 320),
  proposed_description text not null check (char_length(btrim(proposed_description)) between 40 and 5000),
  proposed_services text[] not null default '{}'::text[] check (cardinality(proposed_services) between 1 and 30 and char_length(array_to_string(proposed_services, ',')) <= 3000),
  proposed_official_website_url text check (proposed_official_website_url is null or (char_length(proposed_official_website_url) <= 1000 and proposed_official_website_url ~* '^https?://[^[:space:]]+$')),
  proposed_instagram_url text check (proposed_instagram_url is null or (char_length(proposed_instagram_url) <= 1000 and proposed_instagram_url ~* '^https?://[^[:space:]]+$')),
  proposed_facebook_url text check (proposed_facebook_url is null or (char_length(proposed_facebook_url) <= 1000 and proposed_facebook_url ~* '^https?://[^[:space:]]+$')),
  proposed_enquiry_url text check (proposed_enquiry_url is null or (char_length(proposed_enquiry_url) <= 1000 and proposed_enquiry_url ~* '^https?://[^[:space:]]+$')),
  proposed_starting_price_pence integer check (proposed_starting_price_pence is null or proposed_starting_price_pence >= 0),
  proposed_typical_price_pence integer check (proposed_typical_price_pence is null or proposed_typical_price_pence >= 0),
  proposed_pricing_summary text check (proposed_pricing_summary is null or char_length(proposed_pricing_summary) <= 600),
  proposed_pricing_unit text not null default 'quote' check (proposed_pricing_unit in ('package', 'hour', 'person', 'item', 'event', 'quote')),
  requested_message text not null check (char_length(btrim(requested_message)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 1000),
  previous_values jsonb check (previous_values is null or jsonb_typeof(previous_values) = 'object'),
  applied_values jsonb check (applied_values is null or jsonb_typeof(applied_values) = 'object'),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_update_requests_price_order check (
    proposed_starting_price_pence is null
    or proposed_typical_price_pence is null
    or proposed_typical_price_pence >= proposed_starting_price_pence
  ),
  constraint supplier_update_requests_review_state check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
  )
);

create unique index if not exists supplier_update_requests_one_pending_idx
  on public.supplier_update_requests (supplier_id)
  where status = 'pending';
create index if not exists supplier_update_requests_submitter_idx
  on public.supplier_update_requests (submitted_by, created_at desc);
create index if not exists supplier_update_requests_review_queue_idx
  on public.supplier_update_requests (status, created_at asc);

drop trigger if exists supplier_update_requests_set_updated_at on public.supplier_update_requests;
create trigger supplier_update_requests_set_updated_at
before update on public.supplier_update_requests
for each row execute function public.set_updated_at();

alter table public.vendor_users enable row level security;
alter table public.supplier_update_requests enable row level security;

revoke all on public.supplier_update_requests from public, anon, authenticated;
grant select, insert, update, delete on public.supplier_update_requests to authenticated;
grant select, insert, update, delete on public.supplier_update_requests to service_role;
grant select on public.vendor_users to authenticated;

drop policy if exists "Vendor members read own membership" on public.vendor_users;
drop policy if exists "Vendor users read own links" on public.vendor_users;
create policy "Vendor members read own membership"
  on public.vendor_users for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));

drop policy if exists "Supplier members read managed listings" on public.supplier_listings;
create policy "Supplier members read managed listings"
  on public.supplier_listings for select to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.vendor_users
      where vendor_users.vendor_id = supplier_listings.vendor_id
        and vendor_users.user_id = (select auth.uid())
        and vendor_users.status = 'active'
    )
  );

drop policy if exists "Supplier members read own update requests" on public.supplier_update_requests;
create policy "Supplier members read own update requests"
  on public.supplier_update_requests for select to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.supplier_listings
      join public.vendor_users on vendor_users.vendor_id = supplier_listings.vendor_id
      where supplier_listings.id = supplier_update_requests.supplier_id
        and vendor_users.user_id = (select auth.uid())
        and vendor_users.status = 'active'
    )
  );

drop policy if exists "Supplier members create update requests" on public.supplier_update_requests;
create policy "Supplier members create update requests"
  on public.supplier_update_requests for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and exists (
      select 1
      from public.supplier_listings
      join public.vendor_users on vendor_users.vendor_id = supplier_listings.vendor_id
      where supplier_listings.id = supplier_update_requests.supplier_id
        and supplier_listings.is_claimed is true
        and supplier_listings.claim_status = 'approved'
        and vendor_users.user_id = (select auth.uid())
        and vendor_users.status = 'active'
    )
  );

drop policy if exists "Admins update supplier update requests" on public.supplier_update_requests;
create policy "Admins update supplier update requests"
  on public.supplier_update_requests for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Admins delete supplier update requests" on public.supplier_update_requests;
create policy "Admins delete supplier update requests"
  on public.supplier_update_requests for delete to authenticated
  using ((select private.is_admin()));

create or replace function public.review_supplier_update_request(
  p_request_id uuid,
  p_decision text,
  p_admin_notes text default null
)
returns table (
  reviewed_request_id uuid,
  reviewed_supplier_id uuid,
  supplier_slug text,
  category_slug text,
  review_status text,
  submitted_by uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.supplier_update_requests%rowtype;
  v_supplier public.supplier_listings%rowtype;
  v_notes text := nullif(btrim(left(coalesce(p_admin_notes, ''), 1000)), '');
  v_previous_values jsonb;
  v_applied_values jsonb;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '23514';
  end if;
  if p_decision = 'rejected' and v_notes is null then
    raise exception 'Add a short reason before returning this request' using errcode = '23514';
  end if;

  select requests.* into v_request
  from public.supplier_update_requests as requests
  where requests.id = p_request_id
  for update;
  if not found then
    raise exception 'Supplier update request not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This supplier update request has already been reviewed' using errcode = '55000';
  end if;

  select suppliers.* into v_supplier
  from public.supplier_listings as suppliers
  where suppliers.id = v_request.supplier_id
  for update;
  if not found then
    raise exception 'Supplier linked to this request was not found' using errcode = 'P0002';
  end if;

  v_previous_values := jsonb_build_object(
    'base_town', v_supplier.base_town,
    'region', v_supplier.region,
    'service_areas', v_supplier.service_areas,
    'travels_nationwide', v_supplier.travels_nationwide,
    'summary', v_supplier.summary,
    'description', v_supplier.description,
    'services', v_supplier.services,
    'official_website_url', v_supplier.official_website_url,
    'instagram_url', v_supplier.instagram_url,
    'facebook_url', v_supplier.facebook_url,
    'enquiry_url', v_supplier.enquiry_url,
    'starting_price_pence', v_supplier.starting_price_pence,
    'typical_price_pence', v_supplier.typical_price_pence,
    'pricing_summary', v_supplier.pricing_summary,
    'pricing_unit', v_supplier.pricing_unit
  );

  if p_decision = 'approved' then
    if v_supplier.vendor_id is null
      or v_supplier.is_claimed is not true
      or v_supplier.claim_status <> 'approved'
      or not exists (
        select 1 from public.vendor_users
        where vendor_users.vendor_id = v_supplier.vendor_id
          and vendor_users.user_id = v_request.submitted_by
          and vendor_users.status = 'active'
      ) then
      raise exception 'This request no longer belongs to an active supplier member' using errcode = '42501';
    end if;

    update public.supplier_listings as suppliers
    set base_town = v_request.proposed_base_town,
        region = v_request.proposed_region,
        service_areas = v_request.proposed_service_areas,
        travels_nationwide = v_request.proposed_travels_nationwide,
        summary = v_request.proposed_summary,
        description = v_request.proposed_description,
        services = v_request.proposed_services,
        official_website_url = v_request.proposed_official_website_url,
        instagram_url = v_request.proposed_instagram_url,
        facebook_url = v_request.proposed_facebook_url,
        enquiry_url = v_request.proposed_enquiry_url,
        starting_price_pence = v_request.proposed_starting_price_pence,
        typical_price_pence = v_request.proposed_typical_price_pence,
        pricing_summary = v_request.proposed_pricing_summary,
        pricing_unit = v_request.proposed_pricing_unit,
        reviewed_at = now(),
        reviewed_by = (select auth.uid())
    where suppliers.id = v_request.supplier_id
    returning suppliers.* into v_supplier;

    v_applied_values := jsonb_build_object(
      'base_town', v_supplier.base_town,
      'region', v_supplier.region,
      'service_areas', v_supplier.service_areas,
      'travels_nationwide', v_supplier.travels_nationwide,
      'summary', v_supplier.summary,
      'description', v_supplier.description,
      'services', v_supplier.services,
      'official_website_url', v_supplier.official_website_url,
      'instagram_url', v_supplier.instagram_url,
      'facebook_url', v_supplier.facebook_url,
      'enquiry_url', v_supplier.enquiry_url,
      'starting_price_pence', v_supplier.starting_price_pence,
      'typical_price_pence', v_supplier.typical_price_pence,
      'pricing_summary', v_supplier.pricing_summary,
      'pricing_unit', v_supplier.pricing_unit
    );
  else
    v_applied_values := null;
  end if;

  update public.supplier_update_requests as requests
  set status = p_decision,
      admin_notes = v_notes,
      reviewed_at = now(),
      reviewed_by = (select auth.uid()),
      previous_values = v_previous_values,
      applied_values = v_applied_values
  where requests.id = v_request.id;

  return query select
    v_request.id,
    v_supplier.id,
    v_supplier.slug,
    v_supplier.category_slug,
    p_decision,
    v_request.submitted_by;
end;
$$;

revoke all on function public.review_supplier_update_request(uuid, text, text) from public, anon;
grant execute on function public.review_supplier_update_request(uuid, text, text) to authenticated;

comment on table public.supplier_update_requests is
  'Full bounded supplier profile proposals submitted by active claimed-supplier members for admin review.';

notify pgrst, 'reload schema';
