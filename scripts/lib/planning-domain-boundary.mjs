export const PORTABLE_PLANNING_DOMAIN_MODULES = Object.freeze([
  "src/lib/budget/calculations.ts",
  "src/lib/budget/categories.ts",
  "src/lib/budget/listing-pricing.ts",
  "src/lib/budget/persistence.ts",
  "src/lib/budget/starters.ts",
  "src/lib/budget/types.ts",
  "src/lib/budget/validation.ts",
  "src/lib/planning-hub/date.ts",
  "src/lib/planning-hub/plan.ts",
  "src/lib/planning-hub/supplier-search.ts",
  "src/lib/planning-hub/types.ts",
  "src/lib/planning-workspace/profile.ts",
  "src/lib/planning-workspace/budget-api-schema.ts",
  "src/lib/planning-workspace/recommendations.ts",
  "src/lib/planning-workspace/snapshot-schema.ts",
  "src/lib/planning-workspace/snapshot.ts",
  "src/lib/planning-workspace/table-plan-api-schema.ts",
  "src/lib/planning-workspace/tasks.ts",
  "src/lib/planning-workspace/types.ts",
  "src/lib/planning-workspace/validation.ts",
  "src/lib/table-plan/guests.ts",
  "src/lib/table-plan/planner.ts",
  "src/lib/table-plan/types.ts",
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
