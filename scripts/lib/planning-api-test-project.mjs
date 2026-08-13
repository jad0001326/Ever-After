import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { join, relative } from "node:path";

export const PLANNING_API_BASELINE_MIGRATION = "20000101000000_everaft_schema_baseline.sql";

const INCREMENTAL_SENTINELS = [
  "vendor_image_submissions",
  "vendor_update_reviews",
  "supplier_listings",
  "budget_plans",
  "planning_workspaces",
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertBaselineDoesNotContainIncrementalTables(sql) {
  const normalized = sql.toLowerCase();
  const collisions = INCREMENTAL_SENTINELS.filter((table) => (
    new RegExp(`\\b(?:public\\.)?${table}\\b`, "i").test(normalized)
  ));
  if (collisions.length) {
    throw new Error(
      `supabase/schema.sql now overlaps incremental migrations: ${collisions.join(", ")}. Review and update the test baseline before continuing.`,
    );
  }
}

export async function buildPlanningApiTestProject({ outputRoot, sourceRoot }) {
  if (await exists(outputRoot)) {
    throw new Error(`Refusing to replace existing output: ${outputRoot}`);
  }

  const schemaPath = join(sourceRoot, "supabase", "schema.sql");
  const sourceMigrationsRoot = join(sourceRoot, "supabase", "migrations");
  const schemaBytes = await readFile(schemaPath);
  assertBaselineDoesNotContainIncrementalTables(schemaBytes.toString("utf8"));

  const migrationNames = (await readdir(sourceMigrationsRoot))
    .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right));
  if (migrationNames.length === 0) {
    throw new Error("No timestamped Supabase migrations were found.");
  }
  if (new Set(migrationNames).size !== migrationNames.length) {
    throw new Error("Duplicate Supabase migration filenames were found.");
  }

  const outputMigrationsRoot = join(outputRoot, "supabase", "migrations");
  await mkdir(outputMigrationsRoot, { recursive: true });

  const manifestEntries = [];
  const baselineTarget = join(outputMigrationsRoot, PLANNING_API_BASELINE_MIGRATION);
  await copyFile(schemaPath, baselineTarget);
  manifestEntries.push({
    sha256: sha256(schemaBytes),
    source: "supabase/schema.sql",
    target: `supabase/migrations/${PLANNING_API_BASELINE_MIGRATION}`,
  });

  for (const name of migrationNames) {
    const source = join(sourceMigrationsRoot, name);
    const target = join(outputMigrationsRoot, name);
    const bytes = await readFile(source);
    await copyFile(source, target);
    manifestEntries.push({
      sha256: sha256(bytes),
      source: `supabase/migrations/${name}`,
      target: `supabase/migrations/${name}`,
    });
  }

  const manifest = {
    migrations: manifestEntries,
    purpose: "EverAft Planning Hub local Auth and Data API verification",
    version: 1,
  };
  await writeFile(
    join(outputRoot, "planning-api-test-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(outputRoot, "README.md"),
    [
      "# Generated EverAft Planning API test project",
      "",
      "This directory is disposable and local-only. Its SQL files are copied byte-for-byte",
      "from the EverAft baseline and timestamped migrations; checksums are recorded in",
      "`planning-api-test-manifest.json`.",
      "",
      "From this directory, after installing a container runtime and the Supabase CLI:",
      "",
      "```powershell",
      "supabase init --workdir .",
      "supabase start --workdir .",
      "```",
      "",
      "Do not link this generated project to EverAft production and never use",
      "`supabase db reset --linked`.",
      "",
    ].join("\n"),
    "utf8",
  );

  return {
    manifest,
    outputRoot,
    sourceRoot: relative(outputRoot, sourceRoot),
  };
}
