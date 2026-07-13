import type { Database } from "@/types/database";

type EnrichmentProposalRow = Database["public"]["Tables"]["enrichment_field_proposals"]["Row"];

export type EnrichmentProposalRpcResult = Pick<
  EnrichmentProposalRow,
  "id" | "enrichment_record_id" | "status" | "conflict_reason"
>;

type EnrichmentRpcOperation = "apply" | "rollback";

export type EnrichmentRpcFeedback =
  | { confirmed: true; message: string }
  | { confirmed: false; message: string };

export function inspectEnrichmentRpcResult(
  operation: EnrichmentRpcOperation,
  result: EnrichmentProposalRpcResult | null,
  expected: { proposalId: string; recordId: string }
): EnrichmentRpcFeedback {
  const expectedStatus = operation === "apply" ? "applied" : "rolled_back";
  const successMessage = operation === "apply" ? "Approved changes applied" : "Change rolled back";

  if (!result) {
    return {
      confirmed: false,
      message: `The database did not confirm that the change was ${expectedStatus}. Reload and review before trying again.`
    };
  }

  if (result.id !== expected.proposalId || result.enrichment_record_id !== expected.recordId) {
    return {
      confirmed: false,
      message: "The database returned an unexpected proposal result. Reload and review before trying again."
    };
  }

  if (result.status === expectedStatus) {
    return { confirmed: true, message: successMessage };
  }

  if (result.status === "conflict") {
    const defaultReason = operation === "apply"
      ? "The current value no longer matches the approved previous value."
      : "The current value changed after enrichment was applied."
    const action = operation === "apply" ? "Apply" : "Rollback";
    return {
      confirmed: false,
      message: `${action} blocked: ${result.conflict_reason || defaultReason} No business data was changed. Reload and review this proposal.`
    };
  }

  return {
    confirmed: false,
    message: `The database returned proposal status "${result.status}" instead of confirming that the change was ${expectedStatus}. Reload and review before trying again.`
  };
}
