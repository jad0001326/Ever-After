import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

function assert(condition, message) {
  if (!condition) throw new Error(`Supplier outreach migration contract failed: ${message}`);
}

async function rejects(db, sql, message) {
  try {
    await db.exec(sql);
  } catch {
    return;
  }
  throw new Error(`Supplier outreach migration contract failed: ${message}`);
}

const db = await PGlite.create();

try {
  await db.exec(`
    create table public.supplier_categories (slug text primary key);
    create table public.supplier_listings (id uuid primary key);
    create table public.venues (id uuid primary key);
    create table public.outreach_campaigns (
      id uuid primary key,
      audience_type text not null default 'venue',
      created_at timestamptz not null default now(),
      constraint outreach_campaigns_audience_type_check check (audience_type in ('venue', 'photographer'))
    );
    create table public.outreach_campaign_recipients (
      id uuid primary key,
      campaign_id uuid not null references public.outreach_campaigns(id),
      venue_id uuid references public.venues(id),
      supplier_id uuid references public.supplier_listings(id),
      subject_type text not null default 'venue',
      created_at timestamptz not null default now(),
      constraint outreach_recipients_subject_type_check check (subject_type in ('venue', 'photographer')),
      constraint outreach_recipients_subject_reference_check check (
        (subject_type = 'venue' and supplier_id is null)
        or (subject_type = 'photographer' and supplier_id is not null and venue_id is null)
      )
    );
    insert into public.supplier_categories (slug) values ('photographer'), ('videographer');
    insert into public.supplier_listings (id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
    insert into public.outreach_campaigns (id, audience_type) values ('10000000-0000-0000-0000-000000000001', 'photographer');
    insert into public.outreach_campaign_recipients (id, campaign_id, supplier_id, subject_type)
    values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'photographer');
  `);

  const migration = await readFile(
    new URL("../supabase/migrations/20260803150000_generalize_supplier_outreach.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);

  const legacy = await db.query(`
    select c.audience_type, c.supplier_category_slug, r.subject_type, r.supplier_category_slug as recipient_category
    from public.outreach_campaigns c
    join public.outreach_campaign_recipients r on r.campaign_id = c.id
    where c.id = '10000000-0000-0000-0000-000000000001'
  `);
  assert(legacy.rows[0]?.audience_type === "photographer", "legacy photographer campaigns were rewritten");
  assert(legacy.rows[0]?.supplier_category_slug === null, "legacy campaign unexpectedly gained a category");
  assert(legacy.rows[0]?.subject_type === "photographer", "legacy photographer recipients were rewritten");
  assert(legacy.rows[0]?.recipient_category === null, "legacy recipient unexpectedly gained a category");

  await db.exec(`
    insert into public.outreach_campaigns (id, audience_type, supplier_category_slug)
    values ('10000000-0000-0000-0000-000000000002', 'supplier', 'videographer');
    insert into public.outreach_campaign_recipients (id, campaign_id, supplier_id, subject_type, supplier_category_slug)
    values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'supplier', 'videographer');
  `);

  await rejects(
    db,
    "insert into public.outreach_campaigns (id, audience_type) values ('10000000-0000-0000-0000-000000000003', 'supplier')",
    "a generic supplier campaign was accepted without a category",
  );
  await rejects(
    db,
    "insert into public.outreach_campaign_recipients (id, campaign_id, venue_id, subject_type, supplier_category_slug) values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'supplier', 'videographer')",
    "a supplier recipient was accepted with a venue-shaped reference",
  );

  await db.exec(migration);

  console.log("Supplier outreach migration verification passed: legacy photographer rows remain compatible, category-aware supplier rows are constrained and the migration is repeatable.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.close();
}
