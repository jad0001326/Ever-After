-- Admin-only supplier catalogue acquisition staging. Researched records retain
-- provenance and image-permission state and can only be promoted to drafts.

create table public.supplier_catalogue_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 240),
  source_label text not null check (char_length(btrim(source_label)) between 3 and 240),
  research_date date not null check (research_date <= current_date),
  status text not null default 'open' check (status in ('open', 'reviewed', 'closed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_catalogue_candidates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.supplier_catalogue_batches(id) on delete cascade,
  row_number integer not null check (row_number >= 2),
  identity_key text not null check (char_length(btrim(identity_key)) between 1 and 180),
  category_slug text not null references public.supplier_categories(slug) on update cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  business_name text not null check (char_length(btrim(business_name)) between 1 and 160),
  base_town text not null check (char_length(btrim(base_town)) between 1 and 120),
  region text not null check (char_length(btrim(region)) between 1 and 120),
  country text not null default 'Scotland' check (char_length(btrim(country)) between 1 and 120),
  service_areas text[] not null default '{}'::text[] check (cardinality(service_areas) <= 50 and char_length(array_to_string(service_areas, ',')) <= 4000),
  travels_nationwide boolean not null default false,
  summary text not null check (char_length(btrim(summary)) between 20 and 500),
  description text not null check (char_length(btrim(description)) between 40 and 5000),
  services text[] not null check (cardinality(services) between 1 and 30 and char_length(array_to_string(services, ',')) <= 3000),
  official_website_url text check (official_website_url is null or (char_length(official_website_url) <= 1000 and official_website_url ~* '^https?://[^[:space:]]+$')),
  instagram_url text check (instagram_url is null or (char_length(instagram_url) <= 1000 and instagram_url ~* '^https?://[^[:space:]]+$')),
  facebook_url text check (facebook_url is null or (char_length(facebook_url) <= 1000 and facebook_url ~* '^https?://[^[:space:]]+$')),
  enquiry_url text check (enquiry_url is null or (char_length(enquiry_url) <= 1000 and enquiry_url ~* '^https?://[^[:space:]]+$')),
  starting_price_pence integer check (starting_price_pence is null or starting_price_pence >= 0),
  typical_price_pence integer check (typical_price_pence is null or typical_price_pence >= 0),
  pricing_summary text check (pricing_summary is null or char_length(btrim(pricing_summary)) between 10 and 1000),
  pricing_unit text not null default 'quote' check (pricing_unit in ('package', 'hour', 'person', 'item', 'event', 'quote')),
  hero_image_url text check (hero_image_url is null or (char_length(hero_image_url) <= 1000 and hero_image_url ~* '^https?://[^[:space:]]+$')),
  image_credit text check (image_credit is null or char_length(btrim(image_credit)) between 1 and 240),
  image_permission_status text not null default 'not_provided' check (image_permission_status in ('not_provided', 'pending', 'approved', 'rejected')),
  image_permission_evidence_url text check (image_permission_evidence_url is null or (char_length(image_permission_evidence_url) <= 1000 and image_permission_evidence_url ~* '^https?://[^[:space:]]+$')),
  source_url text not null check (char_length(source_url) <= 1000 and source_url ~* '^https?://[^[:space:]]+$'),
  source_type text not null check (source_type in ('official_website', 'public_business_registry', 'supplier_submitted', 'other_public_source')),
  researched_at date not null check (researched_at <= current_date),
  review_status text not null default 'staged' check (review_status in ('staged', 'accepted', 'rejected', 'duplicate')),
  review_notes text check (review_notes is null or char_length(review_notes) <= 2000),
  listing_id uuid references public.supplier_listings(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_catalogue_candidates_row_unique unique (batch_id, row_number),
  constraint supplier_catalogue_candidates_price_order check (
    starting_price_pence is null or typical_price_pence is null or typical_price_pence >= starting_price_pence
  ),
  constraint supplier_catalogue_candidates_public_presence check (
    official_website_url is not null or instagram_url is not null or facebook_url is not null or enquiry_url is not null
  ),
  constraint supplier_catalogue_candidates_pricing_evidence check (
    starting_price_pence is not null or typical_price_pence is not null or (pricing_unit = 'quote' and pricing_summary is not null)
  ),
  constraint supplier_catalogue_candidates_image_evidence check (
    (hero_image_url is null and image_permission_status = 'not_provided' and image_permission_evidence_url is null)
    or (hero_image_url is not null and image_permission_status in ('pending', 'rejected'))
    or (hero_image_url is not null and image_permission_status = 'approved' and image_permission_evidence_url is not null and image_credit is not null)
  ),
  constraint supplier_catalogue_candidates_review_state check (
    (review_status = 'staged' and reviewed_at is null and reviewed_by is null and listing_id is null)
    or (review_status = 'accepted' and reviewed_at is not null and reviewed_by is not null and listing_id is not null)
    or (review_status in ('rejected', 'duplicate') and reviewed_at is not null and reviewed_by is not null and listing_id is null)
  )
);

create index supplier_catalogue_batches_status_created_idx on public.supplier_catalogue_batches (status, created_at desc);
create index supplier_catalogue_candidates_queue_idx on public.supplier_catalogue_candidates (review_status, created_at asc);
create index supplier_catalogue_candidates_batch_idx on public.supplier_catalogue_candidates (batch_id, row_number);
create index supplier_catalogue_candidates_identity_idx on public.supplier_catalogue_candidates (identity_key, review_status);
create index supplier_catalogue_candidates_source_idx on public.supplier_catalogue_candidates (source_url);

create trigger supplier_catalogue_batches_set_updated_at before update on public.supplier_catalogue_batches
for each row execute function public.set_updated_at();
create trigger supplier_catalogue_candidates_set_updated_at before update on public.supplier_catalogue_candidates
for each row execute function public.set_updated_at();

alter table public.supplier_catalogue_batches enable row level security;
alter table public.supplier_catalogue_candidates enable row level security;

revoke all on public.supplier_catalogue_batches, public.supplier_catalogue_candidates from public, anon, authenticated;
grant select, insert, update, delete on public.supplier_catalogue_batches, public.supplier_catalogue_candidates to authenticated;
grant select, insert, update, delete on public.supplier_catalogue_batches, public.supplier_catalogue_candidates to service_role;

create policy "Admins manage supplier catalogue batches" on public.supplier_catalogue_batches
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage supplier catalogue candidates" on public.supplier_catalogue_candidates
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function public.stage_supplier_catalogue_batch(
  p_file_name text,
  p_source_label text,
  p_research_date date,
  p_candidates jsonb
)
returns table (batch_id uuid, candidate_count integer, duplicate_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_candidate_count integer;
  v_duplicate_count integer;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_candidates) <> 'array' or jsonb_array_length(p_candidates) < 1 or jsonb_array_length(p_candidates) > 500 then
    raise exception 'Choose between 1 and 500 valid supplier candidates' using errcode = '23514';
  end if;

  insert into public.supplier_catalogue_batches (file_name, source_label, research_date, created_by)
  values (btrim(p_file_name), btrim(p_source_label), p_research_date, (select auth.uid()))
  returning id into v_batch_id;

  insert into public.supplier_catalogue_candidates (
    batch_id, row_number, identity_key, category_slug, slug, business_name,
    base_town, region, country, service_areas, travels_nationwide,
    summary, description, services, official_website_url, instagram_url,
    facebook_url, enquiry_url, starting_price_pence, typical_price_pence,
    pricing_summary, pricing_unit, hero_image_url, image_credit,
    image_permission_status, image_permission_evidence_url,
    source_url, source_type, researched_at, review_notes
  )
  select
    v_batch_id, candidate.row_number, candidate.identity_key,
    candidate.category_slug, candidate.slug, candidate.business_name,
    candidate.base_town, candidate.region, candidate.country,
    candidate.service_areas, candidate.travels_nationwide,
    candidate.summary, candidate.description, candidate.services,
    candidate.official_website_url, candidate.instagram_url,
    candidate.facebook_url, candidate.enquiry_url,
    candidate.starting_price_pence, candidate.typical_price_pence,
    candidate.pricing_summary, candidate.pricing_unit,
    candidate.hero_image_url, candidate.image_credit,
    candidate.image_permission_status, candidate.image_permission_evidence_url,
    candidate.source_url, candidate.source_type, candidate.researched_at,
    nullif(concat_ws(
      E'\n',
      candidate.review_notes,
      case when exists (
        select 1 from public.supplier_listings
        where slug = candidate.slug
          or official_website_url = candidate.official_website_url
          or source_url = candidate.source_url
      )
        or exists (
          select 1 from public.supplier_catalogue_candidates as existing
          where (
              existing.identity_key = candidate.identity_key
              or existing.official_website_url = candidate.official_website_url
              or existing.source_url = candidate.source_url
            )
            and existing.review_status in ('staged', 'accepted')
        )
      then 'Possible duplicate: matching listing or active staged identity exists. Review before accepting.' end
    ), '')
  from jsonb_to_recordset(p_candidates) as candidate (
    row_number integer, identity_key text, category_slug text, slug text,
    business_name text, base_town text, region text, country text,
    service_areas text[], travels_nationwide boolean, summary text,
    description text, services text[], official_website_url text,
    instagram_url text, facebook_url text, enquiry_url text,
    starting_price_pence integer, typical_price_pence integer,
    pricing_summary text, pricing_unit text, hero_image_url text,
    image_credit text, image_permission_status text,
    image_permission_evidence_url text, source_url text, source_type text,
    researched_at date, review_notes text
  );
  get diagnostics v_candidate_count = row_count;
  select count(*)::integer into v_duplicate_count
  from public.supplier_catalogue_candidates
  where supplier_catalogue_candidates.batch_id = v_batch_id
    and supplier_catalogue_candidates.review_notes like '%Possible duplicate:%';

  return query select v_batch_id, v_candidate_count, v_duplicate_count;
end;
$$;

create or replace function public.review_supplier_catalogue_candidates(
  p_candidate_ids uuid[],
  p_decision text,
  p_review_notes text default null
)
returns table (candidate_id uuid, listing_id uuid, review_status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_candidate public.supplier_catalogue_candidates%rowtype;
  v_listing_id uuid;
  v_notes text := nullif(btrim(left(coalesce(p_review_notes, ''), 2000)), '');
  v_expected_count integer;
  v_reviewed_count integer := 0;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_decision not in ('accepted', 'rejected', 'duplicate') then
    raise exception 'Decision must be accepted, rejected or duplicate' using errcode = '23514';
  end if;
  if coalesce(cardinality(p_candidate_ids), 0) < 1 or cardinality(p_candidate_ids) > 100 then
    raise exception 'Choose between 1 and 100 candidates' using errcode = '23514';
  end if;
  select count(distinct requested.id)::integer into v_expected_count from unnest(p_candidate_ids) as requested(id);
  if v_expected_count <> cardinality(p_candidate_ids) then
    raise exception 'Candidate identifiers must be unique' using errcode = '23514';
  end if;
  if p_decision in ('rejected', 'duplicate') and v_notes is null then
    raise exception 'A review note is required for rejected or duplicate candidates' using errcode = '23514';
  end if;

  for v_candidate in
    select candidates.* from public.supplier_catalogue_candidates as candidates
    where candidates.id = any(p_candidate_ids)
    order by candidates.id
    for update
  loop
    if v_candidate.review_status <> 'staged' then
      raise exception 'Candidate % has already been reviewed', v_candidate.id using errcode = '55000';
    end if;

    if p_decision = 'accepted' and v_candidate.review_notes is not null and v_notes is null then
      raise exception 'Candidate % has a manual review note; record its resolution before acceptance', v_candidate.id using errcode = '23514';
    end if;

    if p_decision = 'accepted' then
      if exists (
        select 1 from public.supplier_listings
        where slug = v_candidate.slug
          or official_website_url = v_candidate.official_website_url
          or source_url = v_candidate.source_url
      ) then
        raise exception 'Candidate % duplicates an existing supplier identity or source', v_candidate.id using errcode = '23505';
      end if;

      insert into public.supplier_listings (
        category_slug, slug, name, base_town, region, country, service_areas,
        travels_nationwide, summary, description, services,
        official_website_url, instagram_url, facebook_url, enquiry_url, source_url,
        starting_price_pence, typical_price_pence, pricing_summary, pricing_unit,
        hero_image_url, image_credit, image_permission_status,
        listing_status, is_claimed, is_featured, reviewed_at, reviewed_by
      ) values (
        v_candidate.category_slug, v_candidate.slug, v_candidate.business_name,
        v_candidate.base_town, v_candidate.region, v_candidate.country,
        v_candidate.service_areas, v_candidate.travels_nationwide,
        v_candidate.summary, v_candidate.description, v_candidate.services,
        v_candidate.official_website_url, v_candidate.instagram_url,
        v_candidate.facebook_url, v_candidate.enquiry_url, v_candidate.source_url,
        v_candidate.starting_price_pence, v_candidate.typical_price_pence,
        v_candidate.pricing_summary, v_candidate.pricing_unit,
        case when v_candidate.image_permission_status = 'approved' then v_candidate.hero_image_url else null end,
        case when v_candidate.image_permission_status = 'approved' then v_candidate.image_credit else null end,
        case when v_candidate.image_permission_status = 'approved' then 'approved' else 'representative' end,
        'draft', false, false, now(), (select auth.uid())
      ) returning id into v_listing_id;

      if v_candidate.category_slug = 'photographer' then
        insert into public.photographer_profiles (supplier_id) values (v_listing_id)
        on conflict (supplier_id) do nothing;
      end if;
    else
      v_listing_id := null;
    end if;

    update public.supplier_catalogue_candidates as candidates
    set review_status = p_decision,
        review_notes = case
          when v_notes is not null and candidates.review_notes is not null
            then left(candidates.review_notes || E'\nResolution: ' || v_notes, 2000)
          else coalesce(v_notes, candidates.review_notes)
        end,
        listing_id = v_listing_id,
        reviewed_at = now(),
        reviewed_by = (select auth.uid())
    where candidates.id = v_candidate.id;

    candidate_id := v_candidate.id;
    listing_id := v_listing_id;
    review_status := p_decision;
    v_reviewed_count := v_reviewed_count + 1;
    return next;
  end loop;

  if v_reviewed_count <> v_expected_count then
    raise exception 'One or more staged supplier candidates were not found' using errcode = 'P0002';
  end if;

  update public.supplier_catalogue_batches as batches
  set status = 'reviewed'
  where batches.id in (
    select distinct candidates.batch_id
    from public.supplier_catalogue_candidates as candidates
    where candidates.id = any(p_candidate_ids)
  )
  and not exists (
    select 1 from public.supplier_catalogue_candidates as remaining
    where remaining.batch_id = batches.id and remaining.review_status = 'staged'
  );
end;
$$;

revoke all on function public.stage_supplier_catalogue_batch(text, text, date, jsonb) from public, anon;
grant execute on function public.stage_supplier_catalogue_batch(text, text, date, jsonb) to authenticated;
revoke all on function public.review_supplier_catalogue_candidates(uuid[], text, text) from public, anon;
grant execute on function public.review_supplier_catalogue_candidates(uuid[], text, text) to authenticated;

comment on table public.supplier_catalogue_batches is 'Admin-only source-backed supplier acquisition batches; never public catalogue content.';
comment on table public.supplier_catalogue_candidates is 'Admin-only researched supplier candidates requiring explicit review before draft creation.';

notify pgrst, 'reload schema';
