import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { planningDashboardSnapshotJsonSchema } from "../src/lib/planning-workspace/snapshot-schema.ts";

const schemaPath = fileURLToPath(new URL(
  "../docs/planning-hub/contracts/planning-dashboard-snapshot.v1.schema.json",
  import.meta.url,
));
const generated = `${JSON.stringify(
  planningDashboardSnapshotJsonSchema,
  null,
  2,
)}\n`;

if (process.argv.includes("--write")) {
  await writeFile(schemaPath, generated, "utf8");
  console.log(`Wrote ${schemaPath}`);
} else {
  const current = await readFile(schemaPath, "utf8").catch(() => "");
  if (current !== generated) {
    console.error(
      "Planning Dashboard JSON Schema is stale. Run npm run planning-contract:write.",
    );
    process.exitCode = 1;
  } else {
    console.log("Planning Dashboard JSON Schema is current.");
  }
}
