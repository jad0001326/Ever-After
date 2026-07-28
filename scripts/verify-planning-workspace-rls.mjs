import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const migrationPaths = [
  "supabase/migrations/20260723092444_create_budget_plans.sql",
  "supabase/migrations/20260723093146_tighten_budget_plan_grants.sql",
  "supabase/migrations/20260723093318_scope_budget_plan_ids_to_user.sql",
  "supabase/migrations/20260726140200_planning_workspace_foundation.sql",
  "supabase/migrations/20260726162254_planning_workspace_snapshot_import.sql",
  "supabase/migrations/20260726164304_planning_workspace_profiles.sql",
  "supabase/migrations/20260726185032_planning_workspace_partner_budgets.sql",
  "supabase/migrations/20260726191406_planning_table_plan_sync.sql",
];

const planningTables = [
  "budget_plans",
  "planning_workspaces",
  "planning_workspace_members",
  "planning_workspace_profiles",
  "planning_workspace_invites",
  "planning_tasks",
  "planning_guests",
  "planning_tables",
  "planning_seats",
  "planning_seating_rules",
];

const fourCommandPolicyTables = [
  "planning_workspaces",
  "planning_workspace_members",
  "planning_workspace_profiles",
  "planning_tasks",
  "planning_guests",
  "planning_tables",
  "planning_seats",
  "planning_seating_rules",
];

const readSql = async (relativePath) => (
  readFile(new URL(relativePath, new URL("../", import.meta.url)), "utf8")
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Planning workspace security contract failed: ${message}`);
  }
}

async function assertSchemaContract(db) {
  const rlsResult = await db.query(`
    select c.relname as table_name, c.relrowsecurity as rls_enabled
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any($1::text[])
    order by c.relname
  `, [planningTables]);

  assert(
    rlsResult.rows.length === planningTables.length,
    `expected ${planningTables.length} planning tables, found ${rlsResult.rows.length}`,
  );
  for (const row of rlsResult.rows) {
    assert(row.rls_enabled, `${row.table_name} does not have RLS enabled`);
  }

  const anonymousPrivileges = await db.query(`
    select c.relname as table_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any($1::text[])
      and (
        pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
        or pg_catalog.has_table_privilege('anon', c.oid, 'INSERT')
        or pg_catalog.has_table_privilege('anon', c.oid, 'UPDATE')
        or pg_catalog.has_table_privilege('anon', c.oid, 'DELETE')
      )
  `, [planningTables]);
  assert(
    anonymousPrivileges.rows.length === 0,
    `anon retains table privileges on ${anonymousPrivileges.rows.map((row) => row.table_name).join(", ")}`,
  );

  const policyResult = await db.query(`
    select tablename, array_agg(distinct cmd order by cmd) as commands
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any($1::text[])
    group by tablename
  `, [planningTables]);
  const commandsByTable = new Map(
    policyResult.rows.map((row) => [row.tablename, row.commands]),
  );

  for (const table of fourCommandPolicyTables) {
    const commands = commandsByTable.get(table) ?? [];
    for (const command of ["DELETE", "INSERT", "SELECT", "UPDATE"]) {
      assert(commands.includes(command), `${table} has no ${command} policy`);
    }
  }
  for (const command of ["INSERT", "SELECT", "UPDATE"]) {
    assert(
      (commandsByTable.get("planning_workspace_invites") ?? []).includes(command),
      `planning_workspace_invites has no ${command} policy`,
    );
  }
  for (const command of ["DELETE", "INSERT", "SELECT", "UPDATE"]) {
    assert(
      (commandsByTable.get("budget_plans") ?? []).includes(command),
      `budget_plans has no ${command} policy`,
    );
  }

  const unsafePolicyRoles = await db.query(`
    select tablename, policyname, roles
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any($1::text[])
      and (roles @> array['public']::name[] or roles @> array['anon']::name[])
  `, [planningTables]);
  assert(
    unsafePolicyRoles.rows.length === 0,
    "a planning policy is assigned to public or anon",
  );

  const functionResult = await db.query(`
    select
      n.nspname as schema_name,
      p.proname as function_name,
      p.prosecdef as security_definer,
      coalesce(p.proconfig @> array['search_path=""']::text[], false) as empty_search_path,
      pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
      pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (
      ('public', 'accept_planning_workspace_invite'),
      ('public', 'import_planning_workspace_snapshot'),
      ('public', 'import_planning_workspace_snapshot_v2'),
      ('public', 'sync_planning_table_plan'),
      ('private', 'can_access_planning_workspace'),
      ('private', 'owns_planning_workspace'),
      ('private', 'current_verified_planning_email'),
      ('private', 'can_access_planning_budget_plan')
    )
  `);

  assert(functionResult.rows.length === 8, "expected eight security-sensitive functions");
  for (const row of functionResult.rows) {
    assert(row.empty_search_path, `${row.schema_name}.${row.function_name} has a mutable search_path`);
    assert(!row.anon_execute, `anon can execute ${row.schema_name}.${row.function_name}`);

    if (row.schema_name === "public") {
      assert(
        row.authenticated_execute,
        `authenticated cannot execute ${row.schema_name}.${row.function_name}`,
      );
      assert(
        !row.service_execute,
        `service_role can execute ${row.schema_name}.${row.function_name}`,
      );
    }
  }

  const definerExpectations = new Map([
    ["accept_planning_workspace_invite", true],
    ["import_planning_workspace_snapshot", false],
    ["import_planning_workspace_snapshot_v2", false],
    ["sync_planning_table_plan", true],
  ]);
  for (const row of functionResult.rows.filter((entry) => entry.schema_name === "public")) {
    assert(
      row.security_definer === definerExpectations.get(row.function_name),
      `${row.function_name} has an unexpected invoker/definer mode`,
    );
  }
}

const db = await PGlite.create({ extensions: { pgcrypto } });

try {
  await db.exec(await readSql("supabase/tests/planning_workspaces_fixture.sql"));
  for (const migrationPath of migrationPaths) {
    await db.exec(await readSql(migrationPath));
  }

  await assertSchemaContract(db);
  await db.exec(await readSql("supabase/tests/planning_workspaces_rls.sql"));
  const rollbackResult = await db.query(`
    select count(*)::integer as test_user_count
    from auth.users
    where id in (
      '30000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000004',
      '50000000-0000-4000-8000-000000000005',
      'b0000000-0000-4000-8000-00000000000b',
      'c0000000-0000-4000-8000-00000000000c'
    )
  `);
  assert(
    rollbackResult.rows[0]?.test_user_count === 0,
    "the transaction scenario did not roll back its synthetic users",
  );

  console.log(
    "Planning workspace RLS verification passed: migrations, schema contract, owner/partner/outsider isolation, invitation security, imports, sync conflicts and anonymous denial.",
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Planning workspace RLS verification failed: ${message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
