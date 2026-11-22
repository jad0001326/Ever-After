-- Manual production cleanup for public EverAft venue copy.
--
-- This is not a Supabase migration. Do not move it into supabase/migrations.
-- CI, `supabase db push`, and this pull request do not run it.
-- The website already hides the launch-review sentence and internal test
-- listings in code. Run this only after reviewing the two previews below,
-- in the Supabase SQL editor or psql, against the production database.
--
-- It rewrites stored summary/description text on rows that still contain the
-- launch-review sentence, and withdraws the internal QA venue from the public
-- catalogue. It does not change environment variables, prices, images, claims,
-- enquiries, or any other supplier.

-- Preview 1. Rows whose public copy still contains the launch-review note.
select id, slug, listing_status, status,
       left(summary, 200) as summary,
       left(description, 280) as description
from public.venues
where summary ilike '%Imported for EverAft launch review%'
   or description ilike '%Imported for EverAft launch review%'
order by slug;

-- Preview 2. The internal test listing shown in photographer search
-- ("Internal QA" / "EverAft Internal Test Venue — Test Listing").
-- Confirm this is only the test row before committing.
select id, slug, name, town, region, status, listing_status
from public.venues
where slug like 'everaft-internal-test-%'
   or name ilike 'EverAft Internal Test%'
   or region = 'Internal QA'
order by slug;

begin;

update public.venues
set
  summary = case
    when btrim(regexp_replace(
      summary,
      '([[:space:]]*Imported for EverAft launch review from public venue research;[[:space:]]*confirm copy, pricing, imagery, and permissions before publishing\.?)+',
      ' ',
      'gi'
    )) = ''
      then name || ' is a wedding venue in ' || town || ', ' || region || '.'
    else btrim(regexp_replace(
      summary,
      '([[:space:]]*Imported for EverAft launch review from public venue research;[[:space:]]*confirm copy, pricing, imagery, and permissions before publishing\.?)+',
      ' ',
      'gi'
    ))
  end,
  description = case
    when btrim(regexp_replace(
      description,
      '([[:space:]]*Imported for EverAft launch review from public venue research;[[:space:]]*confirm copy, pricing, imagery, and permissions before publishing\.?)+',
      ' ',
      'gi'
    )) <> ''
      then btrim(regexp_replace(
        description,
        '([[:space:]]*Imported for EverAft launch review from public venue research;[[:space:]]*confirm copy, pricing, imagery, and permissions before publishing\.?)+',
        ' ',
        'gi'
      ))
    when btrim(regexp_replace(
      summary,
      '([[:space:]]*Imported for EverAft launch review from public venue research;[[:space:]]*confirm copy, pricing, imagery, and permissions before publishing\.?)+',
      ' ',
      'gi'
    )) <> ''
      then btrim(regexp_replace(
        summary,
        '([[:space:]]*Imported for EverAft launch review from public venue research;[[:space:]]*confirm copy, pricing, imagery, and permissions before publishing\.?)+',
        ' ',
        'gi'
      ))
    else name || ' is a wedding venue in ' || town || ', ' || region || '.'
  end,
  updated_at = now()
where summary ilike '%Imported for EverAft launch review%'
   or description ilike '%Imported for EverAft launch review%';

-- Withdraw the internal listing from public catalogue queries.
-- Admin can still find it by listing status "archived".
update public.venues
set listing_status = 'archived',
    updated_at = now()
where listing_status in ('published', 'claimed')
  and (
    slug like 'everaft-internal-test-%'
    or name ilike 'EverAft Internal Test%'
    or region = 'Internal QA'
  );

commit;
