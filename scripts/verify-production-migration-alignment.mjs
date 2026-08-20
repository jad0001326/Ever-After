import { readdir, readFile } from "node:fs/promises";

const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const snapshot = JSON.parse(await readFile(
  new URL("../docs/planning-hub/production-migration-history-2026-08-03.json", import.meta.url),
  "utf8",
));
const activationRunbook = await readFile(
  new URL("../docs/planning-hub/production-activation-runbook.md", import.meta.url),
  "utf8",
);

const expectedOlderDormantPending = [
  "20260726140200_planning_workspace_foundation.sql",
  "20260726162254_planning_workspace_snapshot_import.sql",
  "20260726164304_planning_workspace_profiles.sql",
  "20260726185032_planning_workspace_partner_budgets.sql",
  "20260726191406_planning_table_plan_sync.sql",
  "20260803122711_supplier_owner_update_requests.sql",
  "20260803130045_supplier_catalogue_staging.sql",
  "20260803143000_tighten_data_api_table_grants.sql",
  "20260803150000_generalize_supplier_outreach.sql",
  "20260803165651_supplier_image_submissions.sql",
];
const expectedClaimOnlyPending = "20260820125218_atomic_supplier_claim_review.sql";
const expectedPending = [...expectedOlderDormantPending, expectedClaimOnlyPending];

function assert(condition, message) {
  if (!condition) throw new Error(`Production migration alignment failed: ${message}`);
}

const localFiles = (await readdir(migrationDirectory))
  .filter((file) => /^\d{14}_.+\.sql$/.test(file))
  .sort();
const localSet = new Set(localFiles);
assert(localSet.size === localFiles.length, "duplicate local migration filenames were found");

const remoteFiles = snapshot.migrations.map(({ version, name }) => `${version}_${name}.sql`);
assert(snapshot.projectId === "fryfdniacyhpubfiqnxj", "snapshot targets an unexpected Supabase project");
assert(remoteFiles.length === 26, `snapshot contains ${remoteFiles.length} remote migrations instead of 26`);
assert(new Set(remoteFiles).size === remoteFiles.length, "snapshot contains duplicate migration identities");

const missingRemoteHistory = remoteFiles.filter((file) => !localSet.has(file));
assert(missingRemoteHistory.length === 0, `repository is missing recorded production migrations: ${missingRemoteHistory.join(", ")}`);

const remoteSet = new Set(remoteFiles);
const actualPending = localFiles.filter((file) => !remoteSet.has(file));
assert(
  JSON.stringify(actualPending) === JSON.stringify(expectedPending),
  `pending set changed; expected ${expectedPending.join(", ")}, found ${actualPending.join(", ")}`,
);

const latestRemoteVersion = snapshot.migrations
  .map(({ version }) => version)
  .sort()
  .at(-1);
const backfilledPending = actualPending.filter(
  (file) => file.slice(0, 14) < latestRemoteVersion,
);
assert(
  JSON.stringify(backfilledPending) === JSON.stringify(expectedOlderDormantPending),
  `reviewed older pending set changed; found ${backfilledPending.join(", ")}`,
);
const independentlyDeployablePending = actualPending.filter(
  (file) => file.slice(0, 14) > latestRemoteVersion,
);
assert(
  JSON.stringify(independentlyDeployablePending) === JSON.stringify([expectedClaimOnlyPending]),
  `claim-only pending set changed; found ${independentlyDeployablePending.join(", ")}`,
);

const dbPushCommands = activationRunbook
  .split(/\r?\n/)
  .filter((line) => line.startsWith("npx.cmd") && line.includes(" db push "));
assert(dbPushCommands.length === 2, `activation runbook contains ${dbPushCommands.length} db push commands instead of 2`);
assert(
  /^npx\.cmd --yes supabase@2\.101\.0 db push --linked --dry-run$/m.test(activationRunbook),
  "activation runbook dry run is not the narrow claim-only command",
);
assert(
  /^npx\.cmd --yes supabase@2\.101\.0 db push --linked$/m.test(activationRunbook),
  "activation runbook production command is not the narrow claim-only command",
);
assert(
  dbPushCommands.every((line) => !line.includes("--include-all") && !line.includes("--include-seed") && !line.includes("--include-roles")),
  "claim-only db push commands must not include older migrations, seed data or custom roles",
);

const legacyCopies = [
  ["../supabase/phase11_pricing_recovery.sql", "../supabase/migrations/20260713151556_phase11_pricing_recovery.sql"],
  ["../supabase/phase12_pricing_policy_cleanup.sql", "../supabase/migrations/20260713152210_phase12_pricing_policy_cleanup.sql"],
  ["../supabase/phase13_pricing_context.sql", "../supabase/migrations/20260713161237_phase13_pricing_context.sql"],
];
for (const [legacyPath, migrationPath] of legacyCopies) {
  const [legacySql, migrationSql] = await Promise.all([
    readFile(new URL(legacyPath, import.meta.url), "utf8"),
    readFile(new URL(migrationPath, import.meta.url), "utf8"),
  ]);
  assert(legacySql === migrationSql, `${migrationPath} no longer matches its production-era legacy source`);
}

console.log(`Production migration alignment passed: ${remoteFiles.length} recorded production versions match exactly, ${backfilledPending.length} reviewed older migrations remain dormant, and ${independentlyDeployablePending.length} claim migration is independently deployable.`);
