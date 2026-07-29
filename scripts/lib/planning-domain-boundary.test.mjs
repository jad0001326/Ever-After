// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findPortableDomainViolations,
  PORTABLE_PLANNING_DOMAIN_MODULES,
} from "./planning-domain-boundary.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("portable Planning Hub domain boundary", () => {
  it("keeps the declared shared domain independent of web and server frameworks", async () => {
    const results = await Promise.all(
      PORTABLE_PLANNING_DOMAIN_MODULES.map(async (relativePath) => {
        const source = await readFile(path.join(repositoryRoot, relativePath), "utf8");
        return {
          relativePath,
          violations: findPortableDomainViolations(source),
        };
      }),
    );

    expect(results).toHaveLength(19);
    expect(results.filter((result) => result.violations.length > 0)).toEqual([]);
  });

  it("detects framework, browser, environment and server-adapter coupling", () => {
    expect(findPortableDomainViolations(`
      "use client";
      import type { ReactNode } from "react";
      import { createClient } from "@/lib/supabase/server";
      import path from "node:path";
      const stored = window.localStorage.getItem("plan");
      const query = new URLSearchParams();
      const enabled = process.env.FEATURE_ENABLED;
    `)).toEqual([
      "framework execution directive",
      "browser global",
      "runtime environment",
      "non-portable import: react",
      "non-portable import: @/lib/supabase/server",
      "non-portable import: node:path",
    ]);
  });

  it("fails clearly for invalid source input", () => {
    expect(() => findPortableDomainViolations(null)).toThrow(
      /Portable domain source must be a string/,
    );
  });
});
