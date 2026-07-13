import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

type PublicationManifest = {
  expectedOptions: number;
  expectedNumericOptions: number;
  expectedQuoteRequiredOptions: number;
  expectedVenues: number;
  sourceFingerprints: string[];
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(root, args.from);
const outputPath = path.resolve(root, args.output);
const manifest = validateManifest(JSON.parse(await readFile(manifestPath, "utf8")) as unknown);
const values = manifest.sourceFingerprints.map((fingerprint) => `  ('${fingerprint}')`).join(",\n");
const sql = `-- Generated from ${toPosixPath(path.relative(root, manifestPath))}.
-- Publishes only the exact manually verified allowlist and replaces stale legacy summaries.
begin;

lock table public.venue_price_options in share row exclusive mode;
lock table public.venues in row exclusive mode;

create temporary table selected_pricing_fingerprints (
  fingerprint text primary key
) on commit drop;

insert into selected_pricing_fingerprints (fingerprint) values
${values};

do $$
declare
  selected_count integer;
  matched_count integer;
  selected_venue_count integer;
  numeric_count integer;
  quote_count integer;
  unsafe_count integer;
  unexpected_published_count integer;
begin
  select count(*) into selected_count from selected_pricing_fingerprints;
  if selected_count <> ${manifest.expectedOptions} then
    raise exception 'Publication manifest expected ${manifest.expectedOptions} unique fingerprints, found %', selected_count;
  end if;

  select
    count(*),
    count(distinct option_row.venue_id),
    count(*) filter (where option_row.kind <> 'quote_required'),
    count(*) filter (where option_row.kind = 'quote_required'),
    count(*) filter (
      where option_row.status not in ('draft', 'published')
         or option_row.source_type not in ('official_website', 'official_brochure')
         or option_row.source_url is null
         or option_row.last_checked_at is null
         or option_row.evidence_text is null
    )
  into matched_count, selected_venue_count, numeric_count, quote_count, unsafe_count
  from public.venue_price_options option_row
  join selected_pricing_fingerprints selected
    on selected.fingerprint = option_row.source_fingerprint;

  if matched_count <> ${manifest.expectedOptions}
     or selected_venue_count <> ${manifest.expectedVenues}
     or numeric_count <> ${manifest.expectedNumericOptions}
     or quote_count <> ${manifest.expectedQuoteRequiredOptions}
     or unsafe_count <> 0 then
    raise exception 'Pricing allowlist failed validation: matched %, venues %, numeric %, quotes %, unsafe %',
      matched_count, selected_venue_count, numeric_count, quote_count, unsafe_count;
  end if;

  select count(*) into unexpected_published_count
  from public.venue_price_options option_row
  where option_row.status = 'published'
    and not exists (
      select 1 from selected_pricing_fingerprints selected
      where selected.fingerprint = option_row.source_fingerprint
    );
  if unexpected_published_count <> 0 then
    raise exception 'Refusing to replace % published prices outside this allowlist', unexpected_published_count;
  end if;
end $$;

update public.venue_price_options option_row
set
  status = 'published',
  verification_method = 'official_source',
  verified_at = coalesce(option_row.verified_at, now()),
  published_at = coalesce(option_row.published_at, now()),
  superseded_at = null,
  superseded_by = null
where exists (
  select 1 from selected_pricing_fingerprints selected
  where selected.fingerprint = option_row.source_fingerprint
);

-- Remove every unverified legacy summary before rebuilding only safe, comparable
-- whole-event summaries. VAT-additional prices remain visible as typed options,
-- but cannot silently become an understated budget/search total.
update public.venues
set price_from = null, price_to = null
where price_from is not null or price_to is not null;

with comparable as (
  select distinct on (option_row.venue_id)
    option_row.venue_id,
    option_row.amount_from_pence,
    option_row.amount_to_pence
  from public.venue_price_options option_row
  join selected_pricing_fingerprints selected
    on selected.fingerprint = option_row.source_fingerprint
  where option_row.status = 'published'
    and option_row.kind in ('venue_hire', 'exclusive_use', 'wedding_package')
    and option_row.pricing_unit in ('total', 'per_event')
    and option_row.amount_from_pence is not null
    and (option_row.valid_to is null or option_row.valid_to >= current_date)
    and (
      option_row.tax_label is null
      or option_row.tax_label ~* '\\m(included|inclusive|inc\\.?|exempt|zero[-[:space:]]?rated|not[[:space:]]+applicable)\\M'
    )
  order by option_row.venue_id, option_row.display_priority, option_row.amount_from_pence
)
update public.venues venue
set
  price_from = ceil(comparable.amount_from_pence / 100.0)::integer,
  price_to = case
    when comparable.amount_to_pence is null then null
    else ceil(comparable.amount_to_pence / 100.0)::integer
  end
from comparable
where venue.id = comparable.venue_id;

do $$
declare
  published_count integer;
  published_venue_count integer;
begin
  select count(*), count(distinct option_row.venue_id)
  into published_count, published_venue_count
  from public.venue_price_options option_row
  join selected_pricing_fingerprints selected
    on selected.fingerprint = option_row.source_fingerprint
  where option_row.status = 'published';
  if published_count <> ${manifest.expectedOptions} or published_venue_count <> ${manifest.expectedVenues} then
    raise exception 'Post-publication validation failed: prices %, venues %', published_count, published_venue_count;
  end if;
end $$;

commit;

select
  count(*) as published_options,
  count(distinct option_row.venue_id) as venues_with_published_pricing,
  count(*) filter (where option_row.kind = 'quote_required') as quote_required_options,
  count(*) filter (where option_row.kind <> 'quote_required') as numeric_options,
  count(*) filter (where option_row.tax_label is not null) as options_with_tax_context,
  count(*) filter (where option_row.minimum_nights is not null) as options_with_minimum_nights
from public.venue_price_options option_row
join (values
${manifest.sourceFingerprints.map((fingerprint) => `  ('${fingerprint}')`).join(",\n")}
) as selected(fingerprint)
  on selected.fingerprint = option_row.source_fingerprint
where option_row.status = 'published';
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, sql, "utf8");
process.stdout.write(`${JSON.stringify({
  manifestPath,
  outputPath,
  options: manifest.expectedOptions,
  numericOptions: manifest.expectedNumericOptions,
  quoteRequiredOptions: manifest.expectedQuoteRequiredOptions,
  venues: manifest.expectedVenues,
  databaseWrites: 0,
  emailsSent: 0
}, null, 2)}\n`);

function parseArgs(values: string[]) {
  const map = new Map<string, string>();
  for (const value of values) {
    if (!value.startsWith("--") || !value.includes("=")) continue;
    const separator = value.indexOf("=");
    map.set(value.slice(2, separator), value.slice(separator + 1));
  }
  const from = map.get("from");
  const output = map.get("output");
  if (!from) throw new Error("--from=<publication-manifest.json> is required.");
  if (!output) throw new Error("--output=<publish.sql> is required.");
  return { from, output };
}

function validateManifest(value: unknown): PublicationManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Publication manifest is not an object.");
  const manifest = value as Partial<PublicationManifest>;
  const counts = [manifest.expectedOptions, manifest.expectedNumericOptions, manifest.expectedQuoteRequiredOptions, manifest.expectedVenues];
  if (counts.some((count) => !Number.isSafeInteger(count) || (count ?? 0) <= 0)) throw new Error("Publication manifest has invalid counts.");
  if (!Array.isArray(manifest.sourceFingerprints) || manifest.sourceFingerprints.some((value) => !/^[0-9a-f]{64}$/.test(value))) {
    throw new Error("Publication manifest has invalid source fingerprints.");
  }
  if (new Set(manifest.sourceFingerprints).size !== manifest.sourceFingerprints.length
    || manifest.sourceFingerprints.length !== manifest.expectedOptions
    || manifest.expectedNumericOptions! + manifest.expectedQuoteRequiredOptions! !== manifest.expectedOptions) {
    throw new Error("Publication manifest counts or fingerprints do not reconcile.");
  }
  return manifest as PublicationManifest;
}

function toPosixPath(value: string) {
  return value.replaceAll("\\", "/");
}
