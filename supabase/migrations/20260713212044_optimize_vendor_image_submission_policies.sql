-- Keep vendor and admin access in one policy per action so Postgres evaluates a
-- single permissive policy, and add indexes for the remaining foreign keys.

create index if not exists venue_image_submissions_submitter_idx
  on public.venue_image_submissions (submitted_by, created_at desc);
create index if not exists venue_image_submissions_published_image_idx
  on public.venue_image_submissions (published_image_id)
  where published_image_id is not null;
create index if not exists venue_image_submissions_reviewer_idx
  on public.venue_image_submissions (reviewed_by)
  where reviewed_by is not null;

drop policy if exists "Venue owners read image submissions" on public.venue_image_submissions;
drop policy if exists "Venue owners delete image submissions" on public.venue_image_submissions;
drop policy if exists "Admins manage image submissions" on public.venue_image_submissions;
drop policy if exists "Authenticated read image submissions" on public.venue_image_submissions;
drop policy if exists "Authenticated delete image submissions" on public.venue_image_submissions;
drop policy if exists "Admins update image submissions" on public.venue_image_submissions;

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

drop policy if exists "Venue owners read image submissions" on storage.objects;
drop policy if exists "Venue owners delete image submissions" on storage.objects;
drop policy if exists "Admins read image submissions" on storage.objects;
drop policy if exists "Admins delete image submissions" on storage.objects;
drop policy if exists "Authenticated read image submissions" on storage.objects;
drop policy if exists "Authenticated delete image submissions" on storage.objects;

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

notify pgrst, 'reload schema';
