-- Phase 13: preserve material pricing context alongside each published amount.
--
-- Tax treatment and minimum-stay rules can materially change the real cost of
-- a wedding price. Keeping them structured prevents a base amount from being
-- presented or imported into the budget planner without its qualifier.

do $$
begin
  create type public.venue_price_qualifier as enum ('from', 'fixed', 'range', 'quote');
exception
  when duplicate_object then null;
end $$;

alter table public.venue_price_options
  add column if not exists tax_label text,
  add column if not exists minimum_nights integer,
  add column if not exists price_qualifier public.venue_price_qualifier;

-- An equal upper amount carries no range information. Normalise any legacy
-- occurrence before enforcing the structured qualifier relationship.
update public.venue_price_options
set amount_to_pence = null
where amount_to_pence = amount_from_pence;

update public.venue_price_options
set price_qualifier = case
  when kind = 'quote_required' or pricing_unit = 'quote' then 'quote'::public.venue_price_qualifier
  when amount_to_pence is not null and amount_to_pence > amount_from_pence then 'range'::public.venue_price_qualifier
  else 'from'::public.venue_price_qualifier
end
where price_qualifier is null;

alter table public.venue_price_options
  alter column price_qualifier set default 'from'::public.venue_price_qualifier,
  alter column price_qualifier set not null;

alter table public.venue_price_options
  drop constraint if exists venue_price_options_tax_label_check,
  add constraint venue_price_options_tax_label_check check (
    tax_label is null or char_length(btrim(tax_label)) between 1 and 80
  ),
  drop constraint if exists venue_price_options_minimum_nights_check,
  add constraint venue_price_options_minimum_nights_check check (
    minimum_nights is null or minimum_nights between 1 and 365
  ),
  drop constraint if exists venue_price_options_published_evidence_check,
  add constraint venue_price_options_published_evidence_check check (
    status = 'draft' or (evidence_text is not null and btrim(evidence_text) <> '')
  ),
  drop constraint if exists venue_price_options_qualifier_check,
  add constraint venue_price_options_qualifier_check check (
    (
      kind = 'quote_required'
      and pricing_unit = 'quote'
      and price_qualifier = 'quote'
      and amount_from_pence is null
      and amount_to_pence is null
    )
    or
    (
      kind <> 'quote_required'
      and pricing_unit <> 'quote'
      and amount_from_pence is not null
      and (
        (price_qualifier = 'range' and amount_to_pence is not null and amount_to_pence > amount_from_pence)
        or (price_qualifier in ('from', 'fixed') and amount_to_pence is null)
      )
    )
  );

comment on column public.venue_price_options.tax_label is
  'Material tax qualifier shown with the amount, for example VAT included or VAT additional.';
comment on column public.venue_price_options.minimum_nights is
  'Minimum number of nights attached to the published price or package.';
comment on column public.venue_price_options.price_qualifier is
  'Controls whether a numeric amount is presented as from, fixed or a range; quote is reserved for quote-required rows.';

-- Expired prices must not be returned by public reads. Admins and approved
-- claimed owners retain access through the private branches of the
-- authenticated policy so they can review and replace historical prices.
drop policy if exists "Published venue prices are public" on public.venue_price_options;
drop policy if exists "Authenticated users read allowed venue prices" on public.venue_price_options;

create policy "Published venue prices are public"
on public.venue_price_options
for select
to anon
using (
  status = 'published'
  and (valid_to is null or valid_to >= current_date)
  and exists (
    select 1
    from public.venues
    where venues.id = venue_price_options.venue_id
      and venues.status = 'published'
      and venues.listing_status in ('published', 'claimed')
  )
);

create policy "Authenticated users read allowed venue prices"
on public.venue_price_options
for select
to authenticated
using (
  (
    status = 'published'
    and (valid_to is null or valid_to >= current_date)
    and exists (
      select 1
      from public.venues
      where venues.id = venue_price_options.venue_id
        and venues.status = 'published'
        and venues.listing_status in ('published', 'claimed')
    )
  )
  or (select public.is_admin())
  or exists (
    select 1
    from public.venues
    where venues.id = venue_price_options.venue_id
      and venues.is_claimed = true
      and venues.claim_status = 'approved'
      and venues.claimed_by = (select auth.uid())
  )
);

notify pgrst, 'reload schema';
