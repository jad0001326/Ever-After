import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("global typography", () => {
  it("keeps a local sans-serif stack after removing the remote font loader", () => {
    expect(globalStyles).toMatch(
      /--font-sans:\s*ui-sans-serif,\s*system-ui,[^;]*"Segoe UI",\s*sans-serif;/,
    );
    expect(globalStyles).toMatch(
      /body\s*\{[^}]*font-family:\s*var\(--font-sans,\s*Arial,\s*sans-serif\);/s,
    );
  });
});
