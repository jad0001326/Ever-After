"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isSafeBatchEnrichmentProposal, parseAdminProposedValue } from "@/lib/enrichment/review-policy";
import {
  inspectEnrichmentRpcResult,
  type EnrichmentProposalRpcResult
} from "@/lib/enrichment/rpc-result";
import { createAdminClient } from "@/lib/supabase/admin";

const contactVerificationFields = new Set([
  "vendor_contact_email",
  "vendor_contact_source_url",
  "vendor_contact_verified_at",
  "public_email",
  "contact_page_url"
]);

export async function approveEnrichmentProposal(formData: FormData) {
  const { user } = await requireAdmin();
  const proposalId = requiredId(formData, "proposalId");
  const recordId = requiredId(formData, "recordId");
  const expectedStatus = expectedReviewStatus(formData);
  const database = requireEnrichmentClient(recordId);
  const { data, error } = await database
    .from("enrichment_field_proposals")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq("id", proposalId)
    .eq("enrichment_record_id", recordId)
    .eq("status", expectedStatus)
    .select("id")
    .maybeSingle();

  if (error) returnToRecord(recordId, error.message);
  if (!data) returnToRecord(recordId, "This proposal changed while you were reviewing it. Reload and try again.");
  revalidateEnrichment(recordId);
  redirect(`/admin/enrichment/${recordId}?message=Proposal+approved`);
}

/**
 * Keeps ordinary, high-confidence changes to one deliberate action. Contact
 * fields are intentionally routed through verifyEnrichmentContact so email,
 * evidence and eligibility cannot drift apart again.
 */
export async function approveAndApplyEnrichmentProposal(formData: FormData) {
  const { user } = await requireAdmin();
  const proposalId = requiredId(formData, "proposalId");
  const recordId = requiredId(formData, "recordId");
  const database = requireEnrichmentClient(recordId);
  const { data: proposal, error: proposalError } = await database
    .from("enrichment_field_proposals")
    .select("id, target_field, status")
    .eq("id", proposalId)
    .eq("enrichment_record_id", recordId)
    .maybeSingle();
  if (proposalError) returnToRecord(recordId, proposalError.message);
  if (!proposal) returnToRecord(recordId, "This proposal is no longer available. Reload and try again.");
  if (contactVerificationFields.has(proposal.target_field)) {
    returnToRecord(recordId, "Contact changes need the dedicated Contact verification control so email, source and eligibility stay in sync.");
  }
  if (proposal.status === "pending") {
    const { data: approved, error: approveError } = await database
      .from("enrichment_field_proposals")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq("id", proposalId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (approveError) returnToRecord(recordId, approveError.message);
    if (!approved) returnToRecord(recordId, "This proposal changed while you were reviewing it. Reload and try again.");
  } else if (proposal.status !== "approved") {
    returnToRecord(recordId, "Only pending or approved proposals can be applied.");
  }

  const { data, error } = await database.rpc("apply_enrichment_proposal", { p_proposal_id: proposalId, p_reviewer_id: user.id });
  if (error) returnToRecord(recordId, error.message);
  const feedback = inspectEnrichmentRpcResult("apply", data as EnrichmentProposalRpcResult | null, { proposalId, recordId });
  if (!feedback.confirmed) returnToRecord(recordId, feedback.message);
  revalidateEnrichment(recordId);
  redirect(`/admin/enrichment/${recordId}?message=${encodeURIComponent("Approved and applied")}`);
}

export async function rejectEnrichmentProposal(formData: FormData) {
  const { user } = await requireAdmin();
  const proposalId = requiredId(formData, "proposalId");
  const recordId = requiredId(formData, "recordId");
  const expectedStatus = expectedReviewStatus(formData);
  const database = requireEnrichmentClient(recordId);
  const { data, error } = await database
    .from("enrichment_field_proposals")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .eq("id", proposalId)
    .eq("enrichment_record_id", recordId)
    .eq("status", expectedStatus)
    .select("id")
    .maybeSingle();

  if (error) returnToRecord(recordId, error.message);
  if (!data) returnToRecord(recordId, "This proposal changed while you were reviewing it. Reload and try again.");
  revalidateEnrichment(recordId);
  redirect(`/admin/enrichment/${recordId}?message=Proposal+rejected`);
}

export async function editEnrichmentProposal(formData: FormData) {
  const { user } = await requireAdmin();
  const proposalId = requiredId(formData, "proposalId");
  const recordId = requiredId(formData, "recordId");
  const expectedStatus = expectedReviewStatus(formData);
  const proposedValueInput = formData.get("proposedValue")?.toString().trim() ?? "";
  if (proposedValueInput.length > 20_000) returnToRecord(recordId, "The proposed value is too long.");
  const proposedValue = parseAdminProposedValue(proposedValueInput);
  const database = requireEnrichmentClient(recordId);
  const { data, error } = await database
    .from("enrichment_field_proposals")
    .update({ proposed_value: proposedValue, status: "pending", reviewed_at: null, reviewed_by: user.id })
    .eq("id", proposalId)
    .eq("enrichment_record_id", recordId)
    .eq("status", expectedStatus)
    .select("id")
    .maybeSingle();

  if (error) returnToRecord(recordId, error.message);
  if (!data) returnToRecord(recordId, "This proposal changed while you were editing it. Reload and try again.");
  revalidateEnrichment(recordId);
  redirect(`/admin/enrichment/${recordId}?message=Proposed+value+updated`);
}

export async function markEnrichmentForManualResearch(formData: FormData) {
  await requireAdmin();
  const recordId = requiredId(formData, "recordId");
  const expectedStatus = expectedRecordStatus(formData);
  const database = requireEnrichmentClient(recordId);
  const { data, error } = await database
    .from("enrichment_records")
    .update({ research_status: "manual_review", requires_manual_review: true, locked_by: null, locked_at: null, next_attempt_at: null })
    .eq("id", recordId)
    .eq("research_status", expectedStatus)
    .select("id")
    .maybeSingle();

  if (error) returnToRecord(recordId, error.message);
  if (!data) returnToRecord(recordId, "This record changed while you were reviewing it. Reload and try again.");
  revalidateEnrichment(recordId);
  redirect(`/admin/enrichment/${recordId}?message=Marked+for+manual+research`);
}

export async function requeueEnrichmentVerification(formData: FormData) {
  await requireAdmin();
  const recordId = requiredId(formData, "recordId");
  const expectedStatus = expectedRecordStatus(formData);
  const database = requireEnrichmentClient(recordId);
  const { data, error } = await database
    .from("enrichment_records")
    .update({ research_status: "pending", next_attempt_at: new Date().toISOString(), locked_by: null, locked_at: null, last_error: null })
    .eq("id", recordId)
    .eq("research_status", expectedStatus)
    .select("id")
    .maybeSingle();

  if (error) returnToRecord(recordId, error.message);
  if (!data) returnToRecord(recordId, "This record changed while you were reviewing it. Reload and try again.");
  revalidateEnrichment(recordId);
  redirect(`/admin/enrichment/${recordId}?message=Verification+queued`);
}

export async function batchApproveSafeEnrichmentProposals(formData: FormData) {
  const { user } = await requireAdmin();
  const proposalIds = Array.from(new Set(formData.getAll("proposalIds").map((value) => value.toString()).filter(Boolean))).slice(0, 100);
  if (proposalIds.length === 0) redirect("/admin/enrichment?message=Select+at+least+one+proposal");
  if (formData.get("approvalConfirmed") !== "on") redirect("/admin/enrichment?message=Confirm+the+safe+batch+approval+first");
  const database = requireEnrichmentClient();
  const { data: proposals, error: loadError } = await database
    .from("enrichment_field_proposals")
    .select("id, target_field, confidence, status")
    .in("id", proposalIds);

  if (loadError) redirect(`/admin/enrichment?message=${encodeURIComponent(loadError.message)}`);
  const safeIds = (proposals ?? [])
    .filter((proposal) => isSafeBatchEnrichmentProposal({ confidence: proposal.confidence, status: proposal.status, targetField: proposal.target_field }))
    .map((proposal) => proposal.id as string);
  if (safeIds.length !== proposalIds.length) {
    redirect("/admin/enrichment?message=Batch+approval+is+limited+to+pending+high-confidence+non-sensitive+fields");
  }

  const { data: approved, error } = await database
    .from("enrichment_field_proposals")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .in("id", safeIds)
    .eq("status", "pending")
    .eq("confidence", "high")
    .select("id");
  if (error) redirect(`/admin/enrichment?message=${encodeURIComponent(error.message)}`);
  if ((approved ?? []).length !== safeIds.length) redirect("/admin/enrichment?message=Some+proposals+changed+during+review.+Reload+and+try+again");
  revalidatePath("/admin/enrichment");
  redirect(`/admin/enrichment?message=${encodeURIComponent(`Approved ${safeIds.length} safe proposal${safeIds.length === 1 ? "" : "s"}`)}`);
}

/** Apply every pending, high-confidence non-sensitive proposal in the current review run. */
export async function applyAllSafeEnrichmentProposals(formData: FormData) {
  const { user } = await requireAdmin();
  const runId = requiredId(formData, "runId");
  if (formData.get("approvalConfirmed") !== "on") redirect(`/admin/enrichment?run=${encodeURIComponent(runId)}&message=Confirm+the+safe+changes+before+applying+them`);
  const database = requireEnrichmentClient();
  const { data: latestRun, error: latestRunError } = await database
    .from("enrichment_runs")
    .select("id")
    .eq("mode", "review")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestRunError || latestRun?.id !== runId) {
    redirect(`/admin/enrichment?run=${encodeURIComponent(runId)}&message=Only+the+latest+completed+review+run+can+be+changed`);
  }

  const { data: proposals, error: loadError } = await database
    .from("enrichment_field_proposals")
    .select("id, enrichment_record_id, target_field, confidence, status, enrichment_records!inner(run_id)")
    .eq("enrichment_records.run_id", runId)
    .eq("status", "pending")
    .limit(2_000);
  if (loadError) redirect(`/admin/enrichment?run=${encodeURIComponent(runId)}&message=${encodeURIComponent(loadError.message)}`);

  const safe = (proposals ?? []).filter((proposal) =>
    isSafeBatchEnrichmentProposal({ confidence: proposal.confidence, status: proposal.status, targetField: proposal.target_field })
  );
  if (safe.length === 0) redirect(`/admin/enrichment?run=${encodeURIComponent(runId)}&message=There+are+no+safe+pending+changes+to+apply`);

  const proposalIds = safe.map((proposal) => proposal.id);
  const { data: approved, error: approveError } = await database
    .from("enrichment_field_proposals")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id })
    .in("id", proposalIds)
    .eq("status", "pending")
    .select("id, enrichment_record_id");
  if (approveError || (approved ?? []).length !== safe.length) {
    redirect(`/admin/enrichment?run=${encodeURIComponent(runId)}&message=Some+safe+proposals+changed+before+they+could+be+applied.+Reload+and+try+again`);
  }

  let applied = 0;
  let conflicts = 0;
  for (const proposal of approved ?? []) {
    const { data, error } = await database.rpc("apply_enrichment_proposal", { p_proposal_id: proposal.id, p_reviewer_id: user.id });
    if (error || !data || data.status !== "applied") conflicts += 1;
    else applied += 1;
  }
  revalidatePath("/admin");
  revalidatePath("/admin/enrichment");
  const suffix = conflicts ? `; ${conflicts} need a refresh because their source value changed` : "";
  redirect(`/admin/enrichment?run=${encodeURIComponent(runId)}&message=${encodeURIComponent(`Applied ${applied} safe change${applied === 1 ? "" : "s"}${suffix}`)}`);
}

export async function applyEnrichmentProposal(formData: FormData) {
  const { user } = await requireAdmin();
  const recordId = requiredId(formData, "recordId");
  const proposalId = requiredId(formData, "proposalId");
  const database = requireEnrichmentClient(recordId);
  const { data: proposal, error: proposalError } = await database
    .from("enrichment_field_proposals")
    .select("target_field")
    .eq("id", proposalId)
    .eq("enrichment_record_id", recordId)
    .maybeSingle();
  if (proposalError) returnToRecord(recordId, proposalError.message);
  if (!proposal) returnToRecord(recordId, "This proposal is no longer available. Reload and try again.");
  if (contactVerificationFields.has(proposal.target_field)) {
    returnToRecord(recordId, "Use Contact verification for contact changes so email, source and eligibility stay in sync.");
  }
  const { data, error } = await database.rpc("apply_enrichment_proposal", {
    p_proposal_id: proposalId,
    p_reviewer_id: user.id
  });

  if (error) returnToRecord(recordId, error.message);
  const feedback = inspectEnrichmentRpcResult(
    "apply",
    data as EnrichmentProposalRpcResult | null,
    { proposalId, recordId }
  );
  if (!feedback.confirmed) returnToRecord(recordId, feedback.message);
  revalidateEnrichment(recordId);
  redirect(`/admin/enrichment/${recordId}?message=${encodeURIComponent(feedback.message)}`);
}

export async function verifyEnrichmentContact(formData: FormData) {
  const { user } = await requireAdmin();
  const recordId = requiredId(formData, "recordId");
  const email = formData.get("email")?.toString().trim() ?? "";
  const sourceUrl = formData.get("sourceUrl")?.toString().trim() ?? "";
  const verificationMethod = formData.get("verificationMethod")?.toString().trim() ?? "";
  const verificationNote = formData.get("verificationNote")?.toString().trim() ?? "";
  const expectedUpdatedAt = formData.get("expectedUpdatedAt")?.toString().trim() ?? "";
  if (email.length > 254 || sourceUrl.length > 2048 || verificationNote.length > 2_000 || !expectedUpdatedAt) {
    returnToRecord(recordId, "The contact verification form contains an invalid value. Reload and try again.");
  }
  const database = requireEnrichmentClient(recordId);
  const { data, error } = await database.rpc("verify_enrichment_contact", {
    p_enrichment_record_id: recordId,
    p_email: email,
    p_source_url: sourceUrl,
    p_verification_method: verificationMethod,
    p_verification_note: verificationNote || null,
    p_reviewer_id: user.id,
    p_expected_updated_at: expectedUpdatedAt
  });
  if (error) returnToRecord(recordId, error.message);
  const result = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
  const blockers = Array.isArray(result.blockers) ? result.blockers.filter((value): value is string => typeof value === "string") : [];
  const message = result.eligible === true
    ? "Contact verified. This venue is eligible for the next campaign."
    : `Contact verified. Remaining send blocker${blockers.length === 1 ? "" : "s"}: ${blockers.map((blocker) => blocker.replaceAll("_", " ")).join(", ") || "none"}.`;
  revalidateEnrichment(recordId);
  revalidatePath("/admin/outreach");
  redirect(`/admin/enrichment/${recordId}?message=${encodeURIComponent(message)}`);
}

export async function rollbackEnrichmentChange(formData: FormData) {
  const { user } = await requireAdmin();
  const recordId = requiredId(formData, "recordId");
  const proposalId = requiredId(formData, "proposalId");
  if (formData.get("rollbackConfirmed") !== "on") returnToRecord(recordId, "Confirm the rollback first.");
  const database = requireEnrichmentClient(recordId);
  const { data, error } = await database.rpc("rollback_enrichment_proposal", {
    p_proposal_id: proposalId,
    p_reviewer_id: user.id
  });

  if (error) returnToRecord(recordId, error.message);
  const feedback = inspectEnrichmentRpcResult(
    "rollback",
    data as EnrichmentProposalRpcResult | null,
    { proposalId, recordId }
  );
  if (!feedback.confirmed) returnToRecord(recordId, feedback.message);
  revalidateEnrichment(recordId);
  redirect(`/admin/enrichment/${recordId}?message=${encodeURIComponent(feedback.message)}`);
}

function requireEnrichmentClient(recordId?: string) {
  const client = createAdminClient();
  if (!client) {
    const path = recordId ? `/admin/enrichment/${recordId}` : "/admin/enrichment";
    redirect(`${path}?message=Configure+SUPABASE_SERVICE_ROLE_KEY+before+reviewing+enrichment+records`);
  }
  return client as unknown as SupabaseClient;
}

function requiredId(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();
  if (!value || value.length > 128) redirect("/admin/enrichment?message=The+requested+enrichment+record+is+invalid");
  return value;
}

function expectedReviewStatus(formData: FormData) {
  return formData.get("expectedStatus")?.toString().trim() || "pending";
}

function expectedRecordStatus(formData: FormData) {
  return formData.get("expectedStatus")?.toString().trim() || "pending";
}

function returnToRecord(recordId: string, message: string): never {
  redirect(`/admin/enrichment/${recordId}?message=${encodeURIComponent(message)}`);
}

function revalidateEnrichment(recordId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/enrichment");
  revalidatePath(`/admin/enrichment/${recordId}`);
}
