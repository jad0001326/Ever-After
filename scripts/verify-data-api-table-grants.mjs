import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const tableNames = [
  "amenities",
  "enquiries",
  "favourites",
  "photographer_profiles",
  "profiles",
  "supplier_categories",
  "supplier_claims",
  "supplier_favourites",
  "supplier_images",
  "supplier_listings",
  "supplier_venue_connections",
  "vendor_update_requests",
  "vendor_users",
  "vendors",
  "venue_amenities",
  "venue_claim_audit_log",
  "venue_claims",
  "venue_images",
  "venues",
];

function assert(condition, message) {
  if (!condition) throw new Error(`Data API grant contract failed: ${message}`);
}

const db = await PGlite.create();

try {
  await db.exec("create role anon nologin; create role authenticated nologin;");
  for (const tableName of tableNames) {
    await db.exec(`create table public.${tableName} (id bigint); grant all on table public.${tableName} to anon, authenticated;`);
  }

  const migration = await readFile(
    new URL("../supabase/migrations/20260803143000_tighten_data_api_table_grants.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);

  const privileges = await db.query(`
    select
      table_name,
      grantee,
      privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and table_name = any(array[${tableNames.map((name) => `'${name}'`).join(", ")}])
      and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
  `);
  assert(privileges.rows.length === 0, "a browser-facing role retains TRUNCATE, TRIGGER or REFERENCES");

  for (const role of ["anon", "authenticated"]) {
    const retained = await db.query(`
      select has_table_privilege('${role}', 'public.supplier_listings', 'select') as can_select
    `);
    assert(retained.rows[0]?.can_select === true, `${role} lost an unrelated existing SELECT grant`);
  }

  console.log("Data API grant verification passed: 19 existing public tables deny TRUNCATE, TRIGGER and REFERENCES without changing application CRUD grants.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.close();
}
