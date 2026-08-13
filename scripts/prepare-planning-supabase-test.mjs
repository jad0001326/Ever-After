import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlanningApiTestProject } from "./lib/planning-api-test-project.mjs";

function requestedOutput(args) {
  const index = args.indexOf("--output");
  if (index === -1) {
    return join(
      tmpdir(),
      `everaft-planning-api-${Date.now()}-${randomBytes(3).toString("hex")}`,
    );
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error("--output requires a new directory path.");
  }
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = requestedOutput(process.argv.slice(2));
const result = await buildPlanningApiTestProject({ outputRoot, sourceRoot });

console.log(`Prepared local-only Supabase test project: ${result.outputRoot}`);
console.log(`Migration files: ${result.manifest.migrations.length}`);
console.log("Next: install a container runtime and Supabase CLI, then follow the generated README.md.");
