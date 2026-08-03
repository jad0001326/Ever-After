-- Private, rights-confirmed supplier photography submission workflow.
-- Claimed supplier members upload into a private review bucket. Only an
-- administrator can publish a processed copy into the public supplier bucket.

create table if not exists public.supplier_image_submissions (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_listings(id) on delete cascade,
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
    credit_text is null or (char_length(credit_text) <= 240 and char_length(btrim(credit_text)) >= 1)
  ),
  is_preferred boolean not null default false,
  permission_confirmed boolean not null default false,
  permission_confirmed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 1000),
  published_url text check (published_url is null or (char_length(published_url) <= 2048 and published_url ~* '^https?://[^[:space:]]+$')),
  published_image_id uuid references public.supplier_images(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_image_submissions_permission_check check (
    (permission_confirmed = true and permission_confirmed_at is not null)
    or (permission_confirmed = false and permission_confirmed_at is null)
  ),
  constraint supplier_image_submissions_review_check check (
    (status = 'pending' and published_url is null and published_image_id is null)
    or (status = 'approved' and published_url is not null and published_image_id is not null)
    or (status = 'rejected' and published_url is null and published_image_id is null)
  )
);

create index if not exists supplier_image_submissions_supplier_status_idx
  on public.supplier_image_submissions (supplier_id, status, created_at desc);
create index if not exists supplier_image_submissions_review_queue_idx
  on public.supplier_image_submissions (status, created_at asc)
  where status = 'pending';
create index if not exists supplier_image_submissions_submitter_idx
  on public.supplier_image_submissions (submitted_by, created_at desc);

drop trigger if exists supplier_image_submissions_set_updated_at on public.supplier_image_submissions;
create trigger supplier_image_submissions_set_updated_at
before update on public.supplier_image_submissions
for each row execute function public.set_updated_at();

alter table public.supplier_image_submissions enable row level security;

revoke all on public.supplier_image_submissions from public, anon, authenticated;
grant select, insert, update, delete on public.supplier_image_submissions to authenticated;
grant all on public.supplier_image_submissions to service_role;

create policy "Supplier members create image submissions"
on public.supplier_image_submissions
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
  and split_part(storage_path, '/', 2) = supplier_id::text
  and exists (
    select 1
    from storage.objects
    where storage.objects.bucket_id = 'supplier-image-submissions'
      and storage.objects.name = supplier_image_submissions.storage_path
  )
  and exists (
    select 1
    from public.supplier_listings
    join public.vendor_users on vendor_users.vendor_id = supplier_listings.vendor_id
    where supplier_listings.id = supplier_image_submissions.supplier_id
      and supplier_listings.is_claimed is true
      and supplier_listings.claim_status = 'approved'
      and vendor_users.user_id = (select auth.uid())
      and vendor_users.status = 'active'
  )
);

create policy "Supplier members read image submissions"
on public.supplier_image_submissions
for select
to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.supplier_listings
    join public.vendor_users on vendor_users.vendor_id = supplier_listings.vendor_id
    where supplier_listings.id = supplier_image_submissions.supplier_id
      and vendor_users.user_id = (select auth.uid())
      and vendor_users.status = 'active'
  )
);

create policy "Supplier members delete image submissions"
on public.supplier_image_submissions
for delete
to authenticated
using (
  (select private.is_admin())
  or (
    submitted_by = (select auth.uid())
    and status in ('pending', 'rejected')
    and exists (
      select 1
      from public.supplier_listings
      join public.vendor_users on vendor_users.vendor_id = supplier_listings.vendor_id
      where supplier_listings.id = supplier_image_submissions.supplier_id
        and vendor_users.user_id = (select auth.uid())
        and vendor_users.status = 'active'
    )
  )
);

create policy "Admins update supplier image submissions"
on public.supplier_image_submissions
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('supplier-image-submissions', 'supplier-image-submissions', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('supplier-images', 'supplier-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Supplier members upload private images"
on storage.objects
for insert
to authenticated
with check (
  storage.objects.bucket_id = 'supplier-image-submissions'
  and array_length(storage.foldername(storage.objects.name), 1) = 2
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid()::text)
  and lower(storage.extension(storage.objects.name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.supplier_listings
    join public.vendor_users on vendor_users.vendor_id = supplier_listings.vendor_id
    where supplier_listings.id::text = (storage.foldername(storage.objects.name))[2]
      and supplier_listings.is_claimed is true
      and supplier_listings.claim_status = 'approved'
      and vendor_users.user_id = (select auth.uid())
      and vendor_users.status = 'active'
  )
);

create policy "Supplier members read private images"
on storage.objects
for select
to authenticated
using (
  storage.objects.bucket_id = 'supplier-image-submissions'
  and (
    (select private.is_admin())
    or (
      array_length(storage.foldername(storage.objects.name), 1) = 2
      and (storage.foldername(storage.objects.name))[1] = (select auth.uid()::text)
      and storage.objects.owner_id = (select auth.uid()::text)
      and exists (
        select 1
        from public.supplier_listings
        join public.vendor_users on vendor_users.vendor_id = supplier_listings.vendor_id
        where supplier_listings.id::text = (storage.foldername(storage.objects.name))[2]
          and vendor_users.user_id = (select auth.uid())
          and vendor_users.status = 'active'
      )
    )
  )
);

create policy "Supplier members delete private images"
on storage.objects
for delete
to authenticated
using (
  storage.objects.bucket_id = 'supplier-image-submissions'
  and (
    (select private.is_admin())
    or (
      array_length(storage.foldername(storage.objects.name), 1) = 2
      and (storage.foldername(storage.objects.name))[1] = (select auth.uid()::text)
      and storage.objects.owner_id = (select auth.uid()::text)
      and exists (
        select 1
        from public.supplier_listings
        join public.vendor_users on vendor_users.vendor_id = supplier_listings.vendor_id
        where supplier_listings.id::text = (storage.foldername(storage.objects.name))[2]
          and vendor_users.user_id = (select auth.uid())
          and vendor_users.status = 'active'
      )
      and not exists (
        select 1 from public.supplier_image_submissions
        where supplier_image_submissions.storage_path = storage.objects.name
      )
    )
  )
);

create policy "Admins insert public supplier images"
on storage.objects
for insert
to authenticated
with check (
  storage.objects.bucket_id = 'supplier-images'
  and (select private.is_admin())
);

create policy "Admins update public supplier images"
on storage.objects
for update
to authenticated
using (storage.objects.bucket_id = 'supplier-images' and (select private.is_admin()))
with check (storage.objects.bucket_id = 'supplier-images' and (select private.is_admin()));

create policy "Admins delete public supplier images"
on storage.objects
for delete
to authenticated
using (storage.objects.bucket_id = 'supplier-images' and (select private.is_admin()));

comment on table public.supplier_image_submissions is
  'Rights-confirmed supplier image uploads held privately until an administrator reviews and publishes an optimized copy.';

notify pgrst, 'reload schema';
