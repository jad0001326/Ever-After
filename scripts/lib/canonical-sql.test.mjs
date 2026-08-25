import { describe, expect, it } from "vitest";
import {
  canonicalizeSqlLineEndings,
  canonicalSqlSha256Candidates,
} from "./canonical-sql.mjs";

describe("canonical SQL comparison", () => {
  it("treats Windows, Unix and legacy Mac line endings as equivalent", () => {
    const windowsSql = "select 1;\r\nselect 2;\r\n";
    const unixSql = "select 1;\nselect 2;\n";
    const legacyMacSql = "select 1;\rselect 2;\r";

    expect(canonicalizeSqlLineEndings(unixSql)).toBe(canonicalizeSqlLineEndings(windowsSql));
    expect(canonicalizeSqlLineEndings(legacyMacSql)).toBe(canonicalizeSqlLineEndings(windowsSql));
  });

  it("preserves whether the source has a final newline", () => {
    expect(canonicalizeSqlLineEndings("select 1;\n")).not.toBe(
      canonicalizeSqlLineEndings("select 1;"),
    );
  });

  it("continues to detect SQL content drift", () => {
    const unchangedHashes = canonicalSqlSha256Candidates("select 1;\n");
    const changedHashes = canonicalSqlSha256Candidates("select 2;\r\n");

    expect([...unchangedHashes].some((hash) => changedHashes.has(hash))).toBe(false);
  });

  it("offers only LF and CRLF hashes for the same canonical SQL", () => {
    expect(canonicalSqlSha256Candidates("select 1;\r\n")).toHaveLength(2);
    expect(canonicalSqlSha256Candidates("select 1;\n")).toEqual(
      canonicalSqlSha256Candidates("select 1;\r\n"),
    );
  });
});
