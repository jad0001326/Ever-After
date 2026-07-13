import { describe, expect, it } from "vitest";
import { createSubstantiveAuditFingerprint } from "./staging-fingerprint";

describe("enrichment staging fingerprint", () => {
  it("ignores volatile timestamps, output locations, and collection order", () => {
    const first = {
      summary: { generatedAt: "2026-07-12T10:00:00Z", outputPath: "outputs/first", venuesAudited: 2 },
      proposals: [
        { entityId: "b", accessedAt: "2026-07-12T10:01:00Z", fieldName: "phone", proposedValue: "2" },
        { entityId: "a", accessedAt: "2026-07-12T10:02:00Z", fieldName: "phone", proposedValue: "1" }
      ],
      researchResults: [{ targetId: "a", checkedAt: "2026-07-12T10:03:00Z" }]
    };
    const second = {
      researchResults: [{ checkedAt: "2026-07-13T11:03:00Z", targetId: "a" }],
      proposals: [
        { proposedValue: "1", fieldName: "phone", accessedAt: "2026-07-13T11:02:00Z", entityId: "a" },
        { proposedValue: "2", fieldName: "phone", accessedAt: "2026-07-13T11:01:00Z", entityId: "b" }
      ],
      summary: { venuesAudited: 2, sourcePath: "D:/copied/audit.json", generatedAt: "2026-07-13T11:00:00Z" }
    };

    expect(createSubstantiveAuditFingerprint(first)).toBe(createSubstantiveAuditFingerprint(second));
  });

  it("changes when a substantive proposed value changes", () => {
    const original = { proposals: [{ entityId: "a", fieldName: "phone", proposedValue: "1" }] };
    const changed = { proposals: [{ entityId: "a", fieldName: "phone", proposedValue: "2" }] };

    expect(createSubstantiveAuditFingerprint(original)).not.toBe(createSubstantiveAuditFingerprint(changed));
  });
});
