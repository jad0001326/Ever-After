// @vitest-environment node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertBaselineDoesNotContainIncrementalTables,
  buildPlanningApiTestProject,
  PLANNING_API_BASELINE_MIGRATION,
} from "./planning-api-test-project.mjs";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const temporaryRoots = [];

async function temporaryOutput() {
  const parent = await mkdtemp(join(tmpdir(), "everaft-planning-api-test-"));
  temporaryRoots.push(parent);
  return join(parent, "generated");
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, {
    force: true,
    recursive: true,
  })));
});

describe("Planning API local project generator", () => {
  it("copies the baseline and every timestamped migration with matching checksums", async () => {
    const outputRoot = await temporaryOutput();
    const { manifest } = await buildPlanningApiTestProject({ outputRoot, sourceRoot });

    expect(manifest.migrations[0].target).toBe(
      `supabase/migrations/${PLANNING_API_BASELINE_MIGRATION}`,
    );
    expect(manifest.migrations.length).toBeGreaterThan(20);
    expect(manifest.migrations.slice(1).map((entry) => entry.target)).toEqual(
      [...manifest.migrations.slice(1).map((entry) => entry.target)].sort(),
    );
    for (const entry of manifest.migrations) {
      const source = await readFile(join(sourceRoot, entry.source));
      const target = await readFile(join(outputRoot, entry.target));
      expect(target.equals(source)).toBe(true);
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    }

    const writtenManifest = JSON.parse(
      await readFile(join(outputRoot, "planning-api-test-manifest.json"), "utf8"),
    );
    expect(writtenManifest).toEqual(manifest);
  });

  it("refuses existing output instead of overwriting it", async () => {
    const outputRoot = await temporaryOutput();
    await buildPlanningApiTestProject({ outputRoot, sourceRoot });
    await expect(buildPlanningApiTestProject({ outputRoot, sourceRoot }))
      .rejects.toThrow(/Refusing to replace existing output/);
  });

  it("fails when the baseline starts overlapping incremental tables", () => {
    expect(() => assertBaselineDoesNotContainIncrementalTables(
      "create table public.budget_plans (id text);",
    )).toThrow(/budget_plans/);
    expect(() => assertBaselineDoesNotContainIncrementalTables(
      "create table public.profiles (id uuid);",
    )).not.toThrow();
  });
});
