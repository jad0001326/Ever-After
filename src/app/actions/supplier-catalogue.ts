"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/node";
import { requireAdmin } from "@/lib/auth";
import { formatSupplierImportReadiness, getSupplierImportReadiness, parseCsv, parseSupplierCandidateRows, type SupplierImportIssue } from "@/lib/supplier-catalogue-import";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type Mode = "validate" | "stage";
export type SupplierCatalogueImportState = {
  ok: boolean;
  message: string;
  mode: Mode;
  rowsRead: number;
  validRows: number;
  acceptanceReadyRows: number;
  manualReviewRows: number;
  stagedRows: number;
  duplicateHints: number;
  batchId: string | null;
  errors: SupplierImportIssue[];
  warnings: SupplierImportIssue[];
} | null;
type SupplierCatalogueImportResult = Exclude<SupplierCatalogueImportState, null>;

export async function stageSupplierCatalogueFile(_: SupplierCatalogueImportState, formData: FormData): Promise<SupplierCatalogueImportState> {
  const { supabase } = await requireAdminAndClient();
  const mode: Mode = formData.get("mode")?.toString() === "stage" ? "stage" : "validate";
  const file = formData.get("file");
  const sourceLabel = formData.get("sourceLabel")?.toString().trim() ?? "";
  const researchDate = formData.get("researchDate")?.toString().trim() ?? "";
  const empty = (message: string): SupplierCatalogueImportResult => ({ ok: false, message, mode, rowsRead: 0, validRows: 0, acceptanceReadyRows: 0, manualReviewRows: 0, stagedRows: 0, duplicateHints: 0, batchId: null, errors: [], warnings: [] });
  if (!(file instanceof File) || file.size === 0) return empty("Choose a CSV or Excel supplier catalogue file.");
  if (file.size > 5 * 1024 * 1024) return empty("Supplier catalogue files must be 5 MB or smaller.");
  if (sourceLabel.length < 3 || sourceLabel.length > 240) return empty("Add a short source label for this research batch.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(researchDate)) return empty("Add the research date for this batch.");

  let rows: string[][];
  try { rows = await readRows(file); } catch (error) { return empty(error instanceof Error ? error.message : "The supplier file could not be read."); }
  const parsed = parseSupplierCandidateRows(rows, researchDate);
  if (!parsed.candidates.length) return { ...empty("No valid supplier rows are ready."), rowsRead: Math.max(0, rows.length - 1), errors: parsed.errors, warnings: parsed.warnings };
  const candidates = parsed.candidates;
  const readiness = getSupplierImportReadiness(candidates);
  if (candidates.length > 500) return { ...empty("A batch can contain at most 500 valid supplier rows."), rowsRead: Math.max(0, rows.length - 1), ...readiness, errors: parsed.errors, warnings: parsed.warnings };

  const resultBase = { mode, rowsRead: Math.max(0, rows.length - 1), ...readiness, stagedRows: 0, duplicateHints: 0, batchId: null, errors: parsed.errors, warnings: parsed.warnings };
  if (mode === "validate") {
    const acceptanceSummary = formatSupplierImportReadiness(readiness);
    return { ok: parsed.errors.length === 0, message: `${candidates.length} structurally valid row${candidates.length === 1 ? "" : "s"} ready to stage. ${acceptanceSummary} Existing catalogue duplicates are checked during atomic staging.`, ...resultBase };
  }

  const { data, error } = await supabase.rpc("stage_supplier_catalogue_batch", {
    p_file_name: file.name.slice(0, 240),
    p_source_label: sourceLabel,
    p_research_date: researchDate,
    p_candidates: candidates as unknown as Json
  });
  const staged = data?.[0];
  if (error || !staged) return { ok: false, message: error?.message ?? "The supplier batch was not staged.", ...resultBase };
  revalidatePath("/admin");
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/supplier-staging");
  return { ok: true, message: `Staged ${staged.candidate_count} supplier candidate${staged.candidate_count === 1 ? "" : "s"} for review${staged.duplicate_count ? `; ${staged.duplicate_count} need duplicate review` : ""}. No listings were published.`, ...resultBase, stagedRows: staged.candidate_count, duplicateHints: staged.duplicate_count, batchId: staged.batch_id };
}

export async function reviewSupplierCatalogueCandidates(formData: FormData): Promise<never> {
  const { supabase } = await requireAdminAndClient();
  const candidateIds = Array.from(new Set(formData.getAll("candidateIds").map((value) => value.toString().trim()).filter(Boolean))).slice(0, 100);
  const decisionInput = formData.get("decision")?.toString();
  const decision = decisionInput === "accepted" || decisionInput === "rejected" || decisionInput === "duplicate" ? decisionInput : null;
  const notes = formData.get("reviewNotes")?.toString().trim().slice(0, 2000) || null;
  if (!candidateIds.length || !decision) redirectWithMessage("Choose candidates and a valid batch decision.");
  if ((decision === "rejected" || decision === "duplicate") && !notes) redirectWithMessage("Add a review note for rejected or duplicate candidates.");
  const { data, error } = await supabase.rpc("review_supplier_catalogue_candidates", { p_candidate_ids: candidateIds, p_decision: decision, p_review_notes: notes });
  if (error || !data?.length) redirectWithMessage(error?.message ?? "No supplier candidates were reviewed.");
  revalidatePath("/admin");
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/supplier-staging");
  redirectWithMessage(decision === "accepted" ? `${data.length} supplier draft${data.length === 1 ? "" : "s"} created for profile review.` : `${data.length} supplier candidate${data.length === 1 ? "" : "s"} marked ${decision}.`);
}

async function requireAdminAndClient() {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirect("/admin/supplier-staging?message=Configure+Supabase+first");
  return { supabase };
}

async function readRows(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith(".csv")) return parseCsv(buffer.toString("utf8"));
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Use a .csv or .xlsx supplier catalogue file.");
  try { return (await readSheet(buffer, "Supplier Catalogue")).map((row) => row.map((cell) => String(cell ?? ""))); }
  catch { return (await readSheet(buffer, 1)).map((row) => row.map((cell) => String(cell ?? ""))); }
}

function redirectWithMessage(message: string): never {
  redirect(`/admin/supplier-staging?message=${encodeURIComponent(message)}`);
}
