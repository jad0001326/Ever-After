-- Qualify storage.objects.name inside venue ownership subqueries. Without the
-- qualification, Postgres resolves `name` to public.venues.name and every
-- legitimate upload path fails the ownership check.

drop policy if exists "Venue owners upload image submissions" on storage.objects;
drop policy if exists "Authenticated read image submissions" on storage.objects;
drop policy if exists "Authenticated delete image submissions" on storage.objects;

create policy "Venue owners upload image submissions"
on storage.objects
for insert
to authenticated
with check (
  storage.objects.bucket_id = 'venue-image-submissions'
  and array_length(storage.foldername(storage.objects.name), 1) = 2
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid()::text)
  and lower(storage.extension(storage.objects.name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1
    from public.venues
    where venues.id::text = (storage.foldername(storage.objects.name))[2]
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
  storage.objects.bucket_id = 'venue-image-submissions' and (
    (select public.is_admin())
    or (
      array_length(storage.foldername(storage.objects.name), 1) = 2
      and (storage.foldername(storage.objects.name))[1] = (select auth.uid()::text)
      and storage.objects.owner_id = (select auth.uid()::text)
      and exists (
        select 1
        from public.venues
        where venues.id::text = (storage.foldername(storage.objects.name))[2]
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
  storage.objects.bucket_id = 'venue-image-submissions' and (
    (select public.is_admin())
    or (
      array_length(storage.foldername(storage.objects.name), 1) = 2
      and (storage.foldername(storage.objects.name))[1] = (select auth.uid()::text)
      and storage.objects.owner_id = (select auth.uid()::text)
      and exists (
        select 1
        from public.venues
        where venues.id::text = (storage.foldername(storage.objects.name))[2]
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

notify pgrst, 'reload schema';
