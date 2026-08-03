-- Add a category-aware supplier audience without rewriting the existing venue
-- or photographer pipeline. This keeps the migration safe to deploy before
-- the application enables generic supplier outreach.

alter table public.outreach_campaigns
  add column if not exists supplier_category_slug text references public.supplier_categories(slug) on update cascade;

alter table public.outreach_campaign_recipients
  add column if not exists supplier_category_slug text references public.supplier_categories(slug) on update cascade;

alter table public.outreach_campaigns
  drop constraint if exists outreach_campaigns_audience_type_check,
  drop constraint if exists outreach_campaigns_supplier_category_check;

alter table public.outreach_campaign_recipients
  drop constraint if exists outreach_recipients_subject_type_check,
  drop constraint if exists outreach_recipients_subject_reference_check;

alter table public.outreach_campaigns
  add constraint outreach_campaigns_audience_type_check
  check (audience_type in ('venue', 'photographer', 'supplier')),
  add constraint outreach_campaigns_supplier_category_check
  check (
    (audience_type in ('venue', 'photographer') and supplier_category_slug is null)
    or (audience_type = 'supplier' and supplier_category_slug is not null)
  );

alter table public.outreach_campaign_recipients
  add constraint outreach_recipients_subject_type_check
  check (subject_type in ('venue', 'photographer', 'supplier')),
  add constraint outreach_recipients_subject_reference_check
  check (
    (
      subject_type = 'venue'
      and venue_id is not null
      and supplier_id is null
      and supplier_category_slug is null
    )
    or (
      subject_type = 'photographer'
      and supplier_id is not null
      and venue_id is null
      and supplier_category_slug is null
    )
    or (
      subject_type = 'supplier'
      and supplier_id is not null
      and venue_id is null
      and supplier_category_slug is not null
    )
  );

create index if not exists outreach_campaigns_supplier_category_created_idx
  on public.outreach_campaigns (supplier_category_slug, created_at desc)
  where audience_type = 'supplier';

create index if not exists outreach_recipients_supplier_category_idx
  on public.outreach_campaign_recipients (supplier_category_slug, created_at desc)
  where subject_type = 'supplier';

notify pgrst, 'reload schema';
