-- Make venue-owner edit reviews atomic and retain an exact before/after audit.

alter table public.vendor_update_requests
  add column if not exists previous_values jsonb,
  add column if not exists applied_values jsonb;

alter table public.vendor_update_requests
  drop constraint if exists vendor_update_requests_previous_values_object,
  drop constraint if exists vendor_update_requests_applied_values_object;

alter table public.vendor_update_requests
  add constraint vendor_update_requests_previous_values_object check (
    previous_values is null or jsonb_typeof(previous_values) = 'object'
  ),
  add constraint vendor_update_requests_applied_values_object check (
    applied_values is null or jsonb_typeof(applied_values) = 'object'
  );

create or replace function public.review_vendor_update_request(
  p_request_id uuid,
  p_decision text,
  p_admin_notes text default null
)
returns table (
  reviewed_request_id uuid,
  reviewed_venue_id uuid,
  venue_slug text,
  review_status text,
  vendor_user_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.vendor_update_requests%rowtype;
  v_venue public.venues%rowtype;
  v_notes text := nullif(btrim(left(coalesce(p_admin_notes, ''), 1000)), '');
  v_previous_values jsonb;
  v_applied_values jsonb;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '23514';
  end if;

  if p_decision = 'rejected' and v_notes is null then
    raise exception 'Add a short reason before returning this request' using errcode = '23514';
  end if;

  select requests.*
  into v_request
  from public.vendor_update_requests as requests
  where requests.id = p_request_id
  for update;

  if not found then
    raise exception 'Venue update request not found' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'This venue update request has already been reviewed' using errcode = '55000';
  end if;

  select venues.*
  into v_venue
  from public.venues as venues
  where venues.id = v_request.venue_id
  for update;

  if not found then
    raise exception 'Venue linked to this request was not found' using errcode = 'P0002';
  end if;

  v_previous_values := jsonb_build_object(
    'name', v_venue.name,
    'summary', v_venue.summary,
    'description', v_venue.description,
    'official_website_url', v_venue.official_website_url,
    'official_gallery_url', v_venue.official_gallery_url
  );

  if p_decision = 'approved' then
    if v_venue.claimed_by is distinct from v_request.vendor_user_id
      or v_venue.is_claimed is not true
      or v_venue.claim_status <> 'approved' then
      raise exception 'This request no longer belongs to the approved venue owner' using errcode = '42501';
    end if;

    update public.venues as venues
    set name = coalesce(v_request.requested_name, venues.name),
        summary = coalesce(v_request.requested_summary, venues.summary),
        description = coalesce(v_request.requested_description, venues.description),
        official_website_url = coalesce(v_request.requested_official_website_url, venues.official_website_url),
        official_gallery_url = coalesce(v_request.requested_official_gallery_url, venues.official_gallery_url)
    where venues.id = v_request.venue_id
    returning venues.* into v_venue;

    v_applied_values := jsonb_build_object(
      'name', v_venue.name,
      'summary', v_venue.summary,
      'description', v_venue.description,
      'official_website_url', v_venue.official_website_url,
      'official_gallery_url', v_venue.official_gallery_url
    );
  else
    v_applied_values := null;
  end if;

  update public.vendor_update_requests as requests
  set status = p_decision,
      admin_notes = v_notes,
      reviewed_at = now(),
      reviewed_by = (select auth.uid()),
      previous_values = v_previous_values,
      applied_values = v_applied_values
  where requests.id = v_request.id;

  return query
  select v_request.id, v_venue.id, v_venue.slug, p_decision, v_request.vendor_user_id;
end;
$$;

revoke all on function public.review_vendor_update_request(uuid, text, text) from public, anon;
grant execute on function public.review_vendor_update_request(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
