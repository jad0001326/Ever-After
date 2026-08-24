export const PORTABLE_PLANNING_DOMAIN_MODULES = Object.freeze([
  "packages/planning-contracts/src/planning-workspace/budget-api-schema.ts",
  "packages/planning-contracts/src/planning-workspace/profile-api-schema.ts",
  "packages/planning-contracts/src/planning-workspace/snapshot-schema.ts",
  "packages/planning-contracts/src/planning-workspace/table-plan-api-schema.ts",
  "packages/planning-contracts/src/planning-workspace/task-api-schema.ts",
  "packages/planning-contracts/src/planning-workspace/workspace-api-schema.ts",
  "packages/planning-domain/src/budget/calculations.ts",
  "packages/planning-domain/src/budget/categories.ts",
  "packages/planning-domain/src/budget/factory.ts",
  "packages/planning-domain/src/budget/listing-pricing.ts",
  "packages/planning-domain/src/budget/pricing-validity.ts",
  "packages/planning-domain/src/budget/starters.ts",
  "packages/planning-domain/src/budget/types.ts",
  "packages/planning-domain/src/budget/validation.ts",
  "packages/planning-domain/src/ids.ts",
  "packages/planning-domain/src/planning-hub/date.ts",
  "packages/planning-domain/src/planning-hub/plan.ts",
  "packages/planning-domain/src/planning-hub/supplier-categories.ts",
  "packages/planning-domain/src/planning-hub/supplier-search.ts",
  "packages/planning-domain/src/planning-hub/types.ts",
  "packages/planning-domain/src/planning-workspace/profile.ts",
  "packages/planning-domain/src/planning-workspace/recommendations.ts",
  "packages/planning-domain/src/planning-workspace/snapshot.ts",
  "packages/planning-domain/src/planning-workspace/tasks.ts",
  "packages/planning-domain/src/planning-workspace/types.ts",
  "packages/planning-domain/src/planning-workspace/validation.ts",
  "packages/planning-domain/src/table-plan/guests.ts",
  "packages/planning-domain/src/table-plan/planner.ts",
  "packages/planning-domain/src/table-plan/types.ts",
]);

const FORBIDDEN_IMPORT_PREFIXES = [
  "@/app",
  "@/components",
  "@/lib/supabase",
  "@/utils/supabase",
  "@supabase/",
  "next",
  "react",
];

const FORBIDDEN_WEB_ADAPTER_IMPORTS = new Set([
  "./invite",
  "./item-navigation",
  "./navigation",
  "./payments",
  "./profile-navigation",
  "./supplier-roadmap",
  "./workspace",
  "@/lib/planning-hub/item-navigation",
  "@/lib/planning-hub/navigation",
  "@/lib/planning-hub/payments",
  "@/lib/planning-hub/supplier-roadmap",
]);

export function findPortableDomainViolations(source) {
  if (typeof source !== "string") {
    throw new TypeError("Portable domain source must be a string.");
  }

  const violations = [];
  if (/^\s*["']use (?:client|server)["'];?/m.test(source)) {
    violations.push("framework execution directive");
  }
  if (/\b(?:document|localStorage|navigator|sessionStorage|URL|URLSearchParams|window)\b/.test(source)) {
    violations.push("browser global");
  }
  if (/\bprocess\.env\b/.test(source)) {
    violations.push("runtime environment");
  }

  const imports = Array.from(
    source.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    (match) => match[1],
  );
  for (const importedModule of imports) {
    if (
      importedModule.startsWith("node:")
      || FORBIDDEN_WEB_ADAPTER_IMPORTS.has(importedModule)
      || FORBIDDEN_IMPORT_PREFIXES.some((prefix) => (
        importedModule === prefix || importedModule.startsWith(`${prefix}/`)
      ))
    ) {
      violations.push(`non-portable import: ${importedModule}`);
    }
  }

  return Array.from(new Set(violations));
}
