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

export async function applyEnrichmentProposal(formData: FormData) {
  const { user } = await requireAdmin();
  const recordId = requiredId(formData, "recordId");
  const proposalId = requiredId(formData, "proposalId");
  if (formData.get("applyConfirmed") !== "on") returnToRecord(recordId, "Confirm the reviewed changes before applying them.");
  const database = requireEnrichmentClient(recordId);
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
