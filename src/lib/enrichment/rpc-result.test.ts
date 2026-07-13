import { describe, expect, it } from "vitest";
import { inspectEnrichmentRpcResult, type EnrichmentProposalRpcResult } from "./rpc-result";

const expected = { proposalId: "proposal-1", recordId: "record-1" };

function result(
  status: EnrichmentProposalRpcResult["status"],
  conflictReason: string | null = null
): EnrichmentProposalRpcResult {
  return {
    id: expected.proposalId,
    enrichment_record_id: expected.recordId,
    status,
    conflict_reason: conflictReason
  };
}

describe("inspectEnrichmentRpcResult", () => {
  it("confirms only the applied status for apply operations", () => {
    expect(inspectEnrichmentRpcResult("apply", result("applied"), expected)).toEqual({
      confirmed: true,
      message: "Approved changes applied"
    });
    expect(inspectEnrichmentRpcResult("apply", result("approved"), expected).confirmed).toBe(false);
  });

  it("surfaces an apply conflict without reporting success", () => {
    const feedback = inspectEnrichmentRpcResult(
      "apply",
      result("conflict", "The live value changed."),
      expected
    );

    expect(feedback.confirmed).toBe(false);
    expect(feedback.message).toContain("Apply blocked: The live value changed.");
    expect(feedback.message).toContain("No business data was changed.");
  });

  it("confirms only the rolled-back status for rollback operations", () => {
    expect(inspectEnrichmentRpcResult("rollback", result("rolled_back"), expected)).toEqual({
      confirmed: true,
      message: "Change rolled back"
    });
    expect(inspectEnrichmentRpcResult("rollback", result("applied"), expected).confirmed).toBe(false);
  });

  it("surfaces a rollback conflict without reporting success", () => {
    const feedback = inspectEnrichmentRpcResult("rollback", result("conflict"), expected);

    expect(feedback.confirmed).toBe(false);
    expect(feedback.message).toContain("Rollback blocked:");
    expect(feedback.message).toContain("No business data was changed.");
  });

  it("does not confirm missing or mismatched RPC results", () => {
    expect(inspectEnrichmentRpcResult("apply", null, expected).confirmed).toBe(false);
    expect(
      inspectEnrichmentRpcResult("apply", { ...result("applied"), id: "another-proposal" }, expected)
    ).toEqual({
      confirmed: false,
      message: "The database returned an unexpected proposal result. Reload and review before trying again."
    });
  });
});
