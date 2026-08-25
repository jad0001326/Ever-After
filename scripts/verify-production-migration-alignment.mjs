import { readdir, readFile } from "node:fs/promises";
import {
  canonicalizeSqlLineEndings,
  canonicalSqlSha256Candidates,
} from "./lib/canonical-sql.mjs";

const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const snapshot = JSON.parse(await readFile(
  new URL("../docs/planning-hub/production-migration-history-2026-08-25.json", import.meta.url),
  "utf8",
));
const activationRunbook = await readFile(
  new URL("../docs/planning-hub/production-activation-runbook.md", import.meta.url),
  "utf8",
);

const expectedPending = [];

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
assert(remoteFiles.length === 40, `snapshot contains ${remoteFiles.length} remote migrations instead of 40`);
assert(new Set(remoteFiles).size === remoteFiles.length, "snapshot contains duplicate migration identities");

for (const [index, file] of remoteFiles.entries()) {
  const expectedHash = snapshot.migrations[index]?.sha256;
  assert(/^[a-f0-9]{64}$/.test(expectedHash ?? ""), `${file} has no valid recorded SHA-256`);
  const actualHashes = canonicalSqlSha256Candidates(
    await readFile(new URL(file, migrationDirectory), "utf8"),
  );
  assert(
    actualHashes.has(expectedHash),
    `${file} differs from its recorded line-ending-canonical production source hash`,
  );
}

const missingRemoteHistory = remoteFiles.filter((file) => !localSet.has(file));
assert(missingRemoteHistory.length === 0, `repository is missing recorded production migrations: ${missingRemoteHistory.join(", ")}`);

const remoteSet = new Set(remoteFiles);
const actualPending = localFiles.filter((file) => !remoteSet.has(file));
assert(
  JSON.stringify(actualPending) === JSON.stringify(expectedPending),
  `pending set changed; expected none, found ${actualPending.join(", ")}`,
);
assert(snapshot.candidate === undefined, "release manifest still declares a pending candidate");

const dbPushCommands = activationRunbook
  .split(/\r?\n/)
  .filter((line) => line.startsWith("npx.cmd") && line.includes(" db push "));
assert(
  JSON.stringify(dbPushCommands) === JSON.stringify([
    "npx.cmd --yes supabase@2.101.0 db push --linked --dry-run",
  ]),
  `activation runbook has an unexpected migration command set: ${dbPushCommands.join(", ")}`,
);
assert(
  dbPushCommands.every((line) => line.includes("--dry-run") && !line.includes("--include-all") && !line.includes("--include-seed") && !line.includes("--include-roles")),
  "alignment inspection must remain dry-run-only and exclude backfilled migrations, seed data and custom roles",
);
assert(
  activationRunbook.includes("all 40 applied migrations"),
  "activation runbook does not state the complete production alignment contract",
);
assert(
  activationRunbook.includes("zero pending migrations"),
  "activation runbook does not state that production has zero pending migrations",
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
  assert(
    canonicalizeSqlLineEndings(legacySql) === canonicalizeSqlLineEndings(migrationSql),
    `${migrationPath} no longer matches its canonical production-era legacy source`,
  );
}

console.log(`Production migration alignment passed: ${remoteFiles.length} recorded production versions and canonical source hashes match, with zero pending migrations.`);
