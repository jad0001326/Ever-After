import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const snapshot = JSON.parse(await readFile(
  new URL("../docs/planning-hub/production-migration-history-2026-08-20.json", import.meta.url),
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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const localFiles = (await readdir(migrationDirectory))
  .filter((file) => /^\d{14}_.+\.sql$/.test(file))
  .sort();
const localSet = new Set(localFiles);
assert(localSet.size === localFiles.length, "duplicate local migration filenames were found");

const remoteFiles = snapshot.migrations.map(({ version, name }) => `${version}_${name}.sql`);
assert(snapshot.projectId === "fryfdniacyhpubfiqnxj", "snapshot targets an unexpected Supabase project");
assert(remoteFiles.length === 39, `snapshot contains ${remoteFiles.length} remote migrations instead of 39`);
assert(new Set(remoteFiles).size === remoteFiles.length, "snapshot contains duplicate migration identities");

for (const [index, file] of remoteFiles.entries()) {
  const expectedHash = snapshot.migrations[index]?.sha256;
  assert(/^[a-f0-9]{64}$/.test(expectedHash ?? ""), `${file} has no valid recorded SHA-256`);
  const actualHash = sha256(await readFile(new URL(file, migrationDirectory)));
  assert(actualHash === expectedHash, `${file} differs from its recorded production source hash`);
}

const missingRemoteHistory = remoteFiles.filter((file) => !localSet.has(file));
assert(missingRemoteHistory.length === 0, `repository is missing recorded production migrations: ${missingRemoteHistory.join(", ")}`);

const remoteSet = new Set(remoteFiles);
const actualPending = localFiles.filter((file) => !remoteSet.has(file));
assert(
  JSON.stringify(actualPending) === JSON.stringify(expectedPending),
  `pending set changed; expected ${expectedPending.join(", ")}, found ${actualPending.join(", ")}`,
);
assert(snapshot.candidate === undefined, "release manifest still declares a pending candidate");
const latestRemoteVersion = snapshot.migrations
  .map(({ version }) => version)
  .sort()
  .at(-1);
const backfilledPending = actualPending.filter(
  (file) => file.slice(0, 14) < latestRemoteVersion,
);
assert(backfilledPending.length === 0, `older pending migrations reappeared: ${backfilledPending.join(", ")}`);

const dbPushCommands = activationRunbook
  .split(/\r?\n/)
  .filter((line) => line.startsWith("npx.cmd") && line.includes(" db push "));
assert(dbPushCommands.length === 1, `activation runbook contains ${dbPushCommands.length} db push commands instead of one read-only dry run`);
assert(
  /^npx\.cmd --yes supabase@2\.101\.0 db push --linked --dry-run$/m.test(activationRunbook),
  "activation runbook does not retain the read-only migration dry run",
);
assert(
  dbPushCommands.every((line) => !line.includes("--include-seed") && !line.includes("--include-roles")),
  "activation runbook db push commands must not include seed data or custom roles",
);
assert(
  activationRunbook.includes("all 39 applied migrations"),
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
  assert(legacySql === migrationSql, `${migrationPath} no longer matches its production-era legacy source`);
}

console.log(`Production migration alignment passed: ${remoteFiles.length} recorded production versions and source hashes match exactly, zero migrations remain pending, and the runbook contains no production migration command.`);
