import { createHash } from "node:crypto";

const volatileAuditKeys = new Set([
  "accessedAt",
  "checkedAt",
  "completedAt",
  "generatedAt",
  "outputDir",
  "outputPath",
  "sourcePath",
  "startedAt"
]);

/**
 * Identifies the substantive contents of a dry-run audit while ignoring values
 * that naturally change when the same audit is regenerated or moved.
 */
export function createSubstantiveAuditFingerprint(report: unknown) {
  const canonical = JSON.stringify(canonicalizeAuditValue(report));
  return createHash("sha256")
    .update("everaft-enrichment-audit-v2\n")
    .update(canonical)
    .digest("hex");
}

function canonicalizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalizeAuditValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }

  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !volatileAuditKeys.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalizeAuditValue(child)])
  );
}
