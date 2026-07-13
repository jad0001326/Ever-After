export const sensitiveEnrichmentFields = new Set([
  "name",
  "slug",
  "vendor_contact_email",
  "vendor_contact_source_url",
  "vendor_contact_verified_at",
  "business_status",
  "structured_pricing",
  "pricing_status",
  "price_from",
  "price_to",
  "duplicate_status",
  "canonical_entity_id",
  "listing_status",
  "claim_status",
  "invite_status"
]);

export function isSafeBatchEnrichmentProposal(proposal: { confidence: string; status: string; targetField: string; requiresManualReview?: boolean }) {
  return proposal.confidence === "high"
    && proposal.status === "pending"
    && proposal.requiresManualReview !== true
    && !sensitiveEnrichmentFields.has(proposal.targetField);
}

export function parseAdminProposedValue(value: string) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
