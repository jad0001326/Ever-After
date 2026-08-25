import { createHash } from "node:crypto";

export function canonicalizeSqlLineEndings(value) {
  return value.replace(/\r\n?|\n/g, "\n");
}

function sha256(value) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

export function canonicalSqlSha256Candidates(value) {
  const canonicalSql = canonicalizeSqlLineEndings(value);

  return new Set([
    sha256(canonicalSql),
    sha256(canonicalSql.replace(/\n/g, "\r\n")),
  ]);
}
