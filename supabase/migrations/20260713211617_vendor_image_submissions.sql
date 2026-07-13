-- Private, rights-confirmed venue photography submission workflow.
-- Vendor uploads remain private until an administrator approves and publishes them.

create table if not exists public.venue_image_submissions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique check (
    char_length(storage_path) between 5 and 500
    and storage_path = btrim(storage_path)
    and storage_path not like '%//%'
  ),
  original_file_name text not null check (
    char_length(original_file_name) <= 240 and char_length(btrim(original_file_name)) >= 1
  ),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  alt_text text not null check (
    char_length(alt_text) <= 300 and char_length(btrim(alt_text)) >= 3
  ),
  credit_text text check (
    credit_text is null or (char_length(credit_text) <= 200 and char_length(btrim(credit_text)) >= 1)
  ),
  is_preferred boolean not null default false,
  permission_confirmed boolean not null default false,
  permission_confirmed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000),
  published_url text check (published_url is null or char_length(published_url) <= 2048),
  published_image_id uuid references public.venue_images(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_image_submissions_permission_check check (
    (permission_confirmed = true and permission_confirmed_at is not null)
    or (permission_confirmed = false and permission_confirmed_at is null)
  )
);

create index if not exists venue_image_submissions_venue_status_idx
  on public.venue_image_submissions (venue_id, status, created_at desc);
create index if not exists venue_image_submissions_review_queue_idx
  on public.venue_image_submissions (status, created_at asc)
  where status = 'pending';
create index if not exists venue_image_submissions_submitter_idx
  on public.venue_image_submissions (submitted_by, created_at desc);
create index if not exists venue_image_submissions_published_image_idx
  on public.venue_image_submissions (published_image_id)
  where published_image_id is not null;
create index if not exists venue_image_submissions_reviewer_idx
  on public.venue_image_submissions (reviewed_by)
  where reviewed_by is not null;

drop trigger if exists venue_image_submissions_set_updated_at on public.venue_image_submissions;
create trigger venue_image_submissions_set_updated_at
before update on public.venue_image_submissions
for each row execute function public.set_updated_at();

alter table public.venue_image_submissions enable row level security;

revoke all on public.venue_image_submissions from public, anon, authenticated;
grant select, insert, update, delete on public.venue_image_submissions to authenticated;
grant all on public.venue_image_submissions to service_role;

drop policy if exists "Venue owners create image submissions" on public.venue_image_submissions;
drop policy if exists "Venue owners read image submissions" on public.venue_image_submissions;
drop policy if exists "Venue owners delete image submissions" on public.venue_image_submissions;
drop policy if exists "Admins manage image submissions" on public.venue_image_submissions;
drop policy if exists "Authenticated read image submissions" on public.venue_image_submissions;
drop policy if exists "Authenticated delete image submissions" on public.venue_image_submissions;
drop policy if exists "Admins update image submissions" on public.venue_image_submissions;

create policy "Venue owners create image submissions"
on public.venue_image_submissions
for insert
to authenticated
with check (
  submitted_by = (select auth.uid())
  and permission_confirmed = true
  and permission_confirmed_at is not null
  and status = 'pending'
  and admin_notes is null
  and published_url is null
  and published_image_id is null
  and reviewed_at is null
  and reviewed_by is null
  and array_length(string_to_array(storage_path, '/'), 1) = 3
  and split_part(storage_path, '/', 1) = (select auth.uid()::text)
  and split_part(storage_path, '/', 2) = venue_id::text
  and exists (
    select 1
    from storage.objects
    where storage.objects.bucket_id = 'venue-image-submissions'
      and storage.objects.name = venue_image_submissions.storage_path
  )
  and exists (
    select 1
    from public.venues
    where venues.id = venue_image_submissions.venue_id
      and venues.claimed_by = (select auth.uid())
      and venues.is_claimed = true
      and venues.claim_status = 'approved'
  )
);

create policy "Authenticated read image submissions"
on public.venue_image_submissions
for select
to authenticated
using (
  (select public.is_admin())
  or (
    submitted_by = (select auth.uid())
    and exists (
      select 1
      from public.venues
      where venues.id = venue_image_submissions.venue_id
        and venues.claimed_by = (select auth.uid())
        and venues.is_claimed = true
    )
  )
);

create policy "Authenticated delete image submissions"
on public.venue_image_submissions
for delete
to authenticated
using (
  (select public.is_admin())
  or (
    submitted_by = (select auth.uid())
    and status in ('pending', 'rejected')
    and exists (
      select 1
      from public.venues
      where venues.id = venue_image_submissions.venue_id
        and venues.claimed_by = (select auth.uid())
        and venues.is_claimed = true
    )
  )
);

create policy "Admins update image submissions"
on public.venue_image_submissions
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-image-submissions',
  'venue-image-submissions',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Venue owners upload image submissions" on storage.objects;
drop policy if exists "Venue owners read image submissions" on storage.objects;
drop policy if exists "Venue owners delete image submissions" on storage.objects;
drop policy if exists "Admins read image submissions" on storage.objects;
drop policy if exists "Admins delete image submissions" on storage.objects;
drop policy if exists "Authenticated read image submissions" on storage.objects;
drop policy if exists "Authenticated delete image submissions" on storage.objects;

create policy "Venue owners upload image submissions"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'venue-image-submissions'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.venues
    where venues.id::text = (storage.foldername(name))[2]
      and venues.claimed_by = (select auth.uid())
      and venues.is_claimed = true
      and venues.claim_status = 'approved'
  )
);

create policy "Authenticated read image submissions"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'venue-image-submissions' and (
    (select public.is_admin())
    or (
      array_length(storage.foldername(name), 1) = 2
      and (storage.foldername(name))[1] = (select auth.uid()::text)
      and owner_id = (select auth.uid()::text)
      and exists (
        select 1
        from public.venues
        where venues.id::text = (storage.foldername(name))[2]
          and venues.claimed_by = (select auth.uid())
          and venues.is_claimed = true
      )
    )
  )
);

create policy "Authenticated delete image submissions"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'venue-image-submissions' and (
    (select public.is_admin())
    or (
      array_length(storage.foldername(name), 1) = 2
      and (storage.foldername(name))[1] = (select auth.uid()::text)
      and owner_id = (select auth.uid()::text)
      and exists (
        select 1
        from public.venues
        where venues.id::text = (storage.foldername(name))[2]
          and venues.claimed_by = (select auth.uid())
          and venues.is_claimed = true
      )
      and (
        not exists (
          select 1
          from public.venue_image_submissions
          where venue_image_submissions.storage_path = storage.objects.name
        )
        or exists (
          select 1
          from public.venue_image_submissions
          where venue_image_submissions.storage_path = storage.objects.name
            and venue_image_submissions.submitted_by = (select auth.uid())
            and venue_image_submissions.status in ('pending', 'rejected')
        )
      )
    )
  )
);

-- The server action already checks venue ownership. This makes the same rule
-- unavoidable for direct Data API calls as well.
drop policy if exists "Vendor users create update requests" on public.vendor_update_requests;
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

-- Claim approval confirms who manages a venue; it does not approve the
-- existing placeholder image. Repair any claimed rows affected by that old rule.
update public.venues
set image_permission_status = 'representative',
    image_is_representative = true
where image_permission_status = 'approved'
  and image_is_representative = false
  and hero_image in (
    'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=82'
  )
  and not exists (
    select 1 from public.venue_images where venue_images.venue_id = venues.id
  );

notify pgrst, 'reload schema';
