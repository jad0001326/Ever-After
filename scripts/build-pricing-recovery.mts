import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  buildPricingRecovery,
  pricingOptionsToCsv,
  rejectedFindingsToCsv
} from "../src/lib/enrichment/pricing-recovery.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const sourcePath = path.resolve(root, args.from);
const outputDir = path.resolve(root, args.output);
const sourceText = await readFile(sourcePath, "utf8");
const source = JSON.parse(sourceText) as unknown;
const report = buildPricingRecovery(source);

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeJson(path.join(outputDir, "pricing-recovery.json"), report),
  writeJson(path.join(outputDir, "pricing-options.json"), { summary: report.summary, options: report.options }),
  writeFile(path.join(outputDir, "pricing-options.csv"), pricingOptionsToCsv(report.options), "utf8"),
  writeJson(path.join(outputDir, "rejected-findings.json"), { summary: report.summary, rejectedFindings: report.rejectedFindings }),
  writeFile(path.join(outputDir, "rejected-findings.csv"), rejectedFindingsToCsv(report.rejectedFindings), "utf8"),
  writeJson(path.join(outputDir, "summary.json"), report.summary)
]);

process.stdout.write(`${JSON.stringify({
  outputDir,
  sourcePath,
  ...report.summary,
  files: [
    "pricing-recovery.json",
    "pricing-options.json",
    "pricing-options.csv",
    "rejected-findings.json",
    "rejected-findings.csv",
    "summary.json"
  ]
}, null, 2)}\n`);

function parseArgs(values: string[]) {
  const args = new Map<string, string | true>();
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const separator = value.indexOf("=");
    if (separator < 0) args.set(value.slice(2), true);
    else args.set(value.slice(2, separator), value.slice(separator + 1));
  }
  const from = args.get("from");
  const output = args.get("output");
  if (typeof from !== "string" || !from) throw new Error("--from=<path-to-audit.json> is required.");
  if (typeof output !== "string" || !output) throw new Error("--output=<directory> is required.");
  return { from, output };
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
