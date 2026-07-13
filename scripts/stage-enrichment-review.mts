import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createSubstantiveAuditFingerprint } from "../src/lib/enrichment/staging-fingerprint.ts";

type Row = Record<string, unknown>;

type DryRunReport = {
  summary: Row & { mode?: string; databaseWrites?: number };
  records: Array<Row & {
    entityType: string;
    entityId: string;
    businessName: string;
    exactEligibilityBlockersAfter: string[];
    dataQualityIssues: string[];
    businessStatus: string;
    researchStatus: string;
    eligibleUnderCurrentRulesBefore: boolean;
    eligibleUnderCurrentRulesAfter: boolean;
    requiresManualReview: boolean;
  }>;
  proposals: Array<Row & {
    entityType: string;
    entityId: string;
    targetTable: string;
    fieldName: string;
    previousValue: unknown;
    proposedValue: unknown;
    sourceUrl: string;
    sourceTitle: string;
    sourceType: string;
    accessedAt: string;
    confidence: string;
    verificationStatus: string;
    verificationMethod: string;
    reason: string;
    requiresManualReview?: boolean;
  }>;
  researchResults?: Array<Row & {
    targetId: string;
    businessStatus: string;
    emails?: Array<Row & {
      email: string;
      verification: Row & {
        syntaxValid: boolean;
        domainExists: boolean | null;
        mxValid: boolean | null;
        mxHosts: string[];
        disposable: boolean;
        roleBased: boolean;
        domainAssociated: boolean;
        status: string;
        method: string;
        checkedAt: string;
      };
    }>;
  }>;
  emailSafety?: Record<string, {
    checked: boolean;
    suppressionReason: string | null;
    suppressed: boolean | null;
    optedOut: boolean | null;
    hardBounce: boolean | null;
    priorOutreach: boolean | null;
    historyStatuses: string[];
  }>;
  duplicates: Array<{ kind: string; key: string; venueIds: string[] }>;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).filter((value) => value.startsWith("--")).map((value) => {
  const [key, raw] = value.slice(2).split("=", 2);
  return [key, raw ?? true] as const;
}));
if (args.get("confirm-stage-review") !== true) {
  throw new Error("Add --confirm-stage-review after reviewing the dry-run files. Staging creates a private review queue but never changes a venue or sends email.");
}
const from = args.get("from");
if (typeof from !== "string" || !from) throw new Error("--from=<path-to-audit.json> is required.");

await loadEnv(path.join(root, ".env"));
await loadEnv(path.join(root, ".env.local"));
const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const sourcePath = path.resolve(root, from);
const sourceText = await readFile(sourcePath, "utf8");
const report = JSON.parse(sourceText) as DryRunReport;
if (report.summary.mode !== "dry_run" || report.summary.databaseWrites !== 0) {
  throw new Error("The source file is not a verified zero-write dry-run report.");
}
const sourceFingerprint = createSubstantiveAuditFingerprint(report);
const existingRuns = await restGet<Row>("enrichment_runs", {
  select: "*",
  source_fingerprint: `eq.${sourceFingerprint}`,
  limit: "1"
});
let run = existingRuns[0];
if (run?.status === "completed") {
  process.stdout.write(`${JSON.stringify({ staged: false, idempotentReplay: true, runId: run.id, sourcePath }, null, 2)}\n`);
  process.exit(0);
}
if (!run) {
  const created = await restPost<Row>("enrichment_runs", [{
    mode: "review",
    status: "running",
    source_fingerprint: sourceFingerprint,
    scope: { sourcePath, entityTypes: ["venue", "supplier_application"] },
    options: { stagedFromDryRun: true },
    summary: report.summary,
    external_usage: report.summary.research ?? {},
    started_at: new Date().toISOString()
  }], "source_fingerprint", true);
  run = created[0];
} else {
  await restPatch("enrichment_runs", { id: `eq.${String(run.id)}` }, { status: "running", started_at: new Date().toISOString() });
}
if (!run?.id) throw new Error("Could not create or reload the enrichment run.");
const runId = String(run.id);

try {
  const manualReviewEntities = new Set(
    report.proposals
      .filter((proposal) => proposal.requiresManualReview === true)
      .map((proposal) => `${proposal.entityType}:${proposal.entityId}`)
  );
  const recordRows = report.records.map((record) => {
    const requiresManualReview = record.requiresManualReview || manualReviewEntities.has(`${record.entityType}:${record.entityId}`);
    return {
    run_id: runId,
    entity_type: record.entityType,
    entity_id: record.entityId,
    entity_snapshot: record,
    eligibility_blockers: record.exactEligibilityBlockersAfter,
    quality_blockers: record.dataQualityIssues,
    missing_fields: record.dataQualityIssues.filter((issue) => issue.startsWith("missing_")),
    business_status: normalizeBusinessStatus(record.businessStatus),
    research_status: normalizeResearchStatus(record.researchStatus, requiresManualReview),
    requires_manual_review: requiresManualReview,
    before_outreach_eligible: record.eligibleUnderCurrentRulesBefore,
    after_outreach_eligible: record.eligibleUnderCurrentRulesAfter,
    next_attempt_at: requiresManualReview ? null : new Date().toISOString()
    };
  });
  await restPost("enrichment_records", recordRows, "run_id,entity_type,entity_id", false);
  const stagedRecords = await restGet<Row>("enrichment_records", { select: "id,entity_type,entity_id", run_id: `eq.${runId}`, limit: "10000" });
  const recordIdByEntity = new Map(stagedRecords.map((record) => [`${record.entity_type}:${record.entity_id}`, String(record.id)]));

  const proposalRows = report.proposals.flatMap((proposal) => {
    const enrichmentRecordId = recordIdByEntity.get(`${proposal.entityType}:${proposal.entityId}`);
    if (!enrichmentRecordId) return [];
    return [{
      enrichment_record_id: enrichmentRecordId,
      target_table: proposal.targetTable,
      target_field: proposal.fieldName,
      previous_value: proposal.previousValue,
      proposed_value: proposal.proposedValue,
      source_url: proposal.sourceUrl,
      source_title: proposal.sourceTitle,
      source_type: proposal.sourceType,
      source_accessed_at: proposal.accessedAt,
      confidence: proposal.confidence,
      verification_status: normalizeProposalVerification(proposal.verificationStatus),
      verification_method: proposal.verificationMethod,
      reason: proposal.reason,
      status: "pending"
    }];
  });
  await restPost("enrichment_field_proposals", proposalRows, "proposal_fingerprint", false, true);

  const emailCheckRows = (report.researchResults ?? []).flatMap((research) => {
    const enrichmentRecordId = recordIdByEntity.get(`venue:${research.targetId}`);
    if (!enrichmentRecordId) return [];
    return (research.emails ?? []).map((finding) => {
      const verification = finding.verification;
      const emailKey = finding.email.trim().toLowerCase();
      const safety = report.emailSafety?.[emailKey];
      const finalStatus = safety?.optedOut ? "opted_out" : safety?.hardBounce ? "hard_bounce" : safety?.suppressed ? "suppressed" : verification.status;
      return {
        enrichment_record_id: enrichmentRecordId,
        email: finding.email,
        syntax_valid: verification.syntaxValid,
        domain: finding.email.split("@")[1]?.toLowerCase() ?? null,
        domain_exists: verification.domainExists,
        has_mx: verification.mxValid,
        mx_hosts: verification.mxHosts,
        is_disposable: verification.disposable,
        is_role_based: verification.roleBased,
        known_hard_bounce: safety?.hardBounce ?? null,
        is_suppressed: safety?.suppressed ?? null,
        is_opted_out: safety?.optedOut ?? null,
        has_prior_outreach: safety?.priorOutreach ?? null,
        domain_associated: verification.domainAssociated,
        status: finalStatus,
        verification_method: verification.method,
        details: { source: "official-site dry run", suppressionReason: safety?.suppressionReason ?? null, historyStatuses: safety?.historyStatuses ?? [] },
        checked_at: verification.checkedAt
      };
    });
  });
  await restPost("enrichment_email_checks", emailCheckRows, "enrichment_record_id,normalized_email", false);

  const duplicateRows = duplicatePairs(report.duplicates).map((pair) => ({
    run_id: runId,
    left_entity_type: "venue",
    left_entity_id: pair.left,
    right_entity_type: "venue",
    right_entity_id: pair.right,
    match_reasons: pair.reasons,
    match_score: pair.score,
    status: "pending"
  }));
  await restPost("enrichment_duplicate_candidates", duplicateRows, "run_id,left_entity_type,left_entity_id,right_entity_type,right_entity_id", false);

  await restPatch("enrichment_runs", { id: `eq.${runId}` }, {
    status: "completed",
    completed_at: new Date().toISOString(),
    summary: { ...report.summary, stagedRecordCount: recordRows.length, stagedProposalCount: proposalRows.length, stagedEmailCheckCount: emailCheckRows.length, stagedDuplicateCount: duplicateRows.length }
  });
  process.stdout.write(`${JSON.stringify({ staged: true, runId, records: recordRows.length, proposals: proposalRows.length, emailChecks: emailCheckRows.length, duplicates: duplicateRows.length, businessDataChanges: 0, emailsSent: 0 }, null, 2)}\n`);
} catch (error) {
  await restPatch("enrichment_runs", { id: `eq.${runId}` }, { status: "failed", completed_at: new Date().toISOString(), summary: { ...report.summary, stagingError: error instanceof Error ? error.message : String(error) } }).catch(() => undefined);
  throw error;
}

async function restGet<T>(table: string, params: Record<string, string>) {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) throw new Error(`${table} read failed (${response.status}): ${await response.text()}`);
  return await response.json() as T[];
}

async function restPost<T = Row>(table: string, rows: Row[], onConflict: string, returnRows: boolean, ignoreDuplicates = false) {
  if (!rows.length) return [] as T[];
  const returned: T[] = [];
  for (let index = 0; index < rows.length; index += 100) {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    if (onConflict) url.searchParams.set("on_conflict", onConflict);
    const response = await fetch(url, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", Prefer: `resolution=${ignoreDuplicates ? "ignore" : "merge"}-duplicates,return=${returnRows ? "representation" : "minimal"}` },
      body: JSON.stringify(rows.slice(index, index + 100))
    });
    if (!response.ok) throw new Error(`${table} stage failed (${response.status}): ${await response.text()}`);
    if (returnRows) returned.push(...await response.json() as T[]);
  }
  return returned;
}

async function restPatch(table: string, filters: Record<string, string>, value: Row) {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  for (const [key, filter] of Object.entries(filters)) url.searchParams.set(key, filter);
  const response = await fetch(url, { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(value) });
  if (!response.ok) throw new Error(`${table} update failed (${response.status}): ${await response.text()}`);
}

function authHeaders() {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
}

function duplicatePairs(groups: DryRunReport["duplicates"]) {
  const pairs = new Map<string, { left: string; right: string; reasons: string[]; score: number }>();
  for (const group of groups) {
    const ids = [...group.venueIds].sort();
    for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
        const key = `${ids[leftIndex]}:${ids[rightIndex]}`;
        const pair = pairs.get(key) ?? { left: ids[leftIndex], right: ids[rightIndex], reasons: [], score: 0 };
        pair.reasons.push(`${group.kind}:${group.key}`);
        pair.score = Math.max(pair.score, group.kind === "email" ? 1 : group.kind === "website_domain" ? 0.95 : 0.85);
        pairs.set(key, pair);
      }
    }
  }
  return [...pairs.values()];
}

function normalizeBusinessStatus(value: string) {
  return ["active", "likely_active", "temporarily_closed", "closed", "rebranded", "duplicate", "uncertain"].includes(value) ? value : "uncertain";
}

function normalizeResearchStatus(value: string, manual: boolean) {
  if (manual) return "manual_review";
  if (value === "completed") return "researched";
  if (value === "failed") return "failed";
  if (value === "robots_blocked") return "manual_review";
  return "pending";
}

function normalizeProposalVerification(value: string) {
  return ["verified", "likely_valid", "unverified", "invalid", "not_applicable"].includes(value) ? value : "unverified";
}

async function loadEnv(filePath: string) {
  try {
    const text = await readFile(filePath, "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const index = line.indexOf("=");
      process.env[line.slice(0, index).trim()] ??= line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to stage a reviewed dry run.`);
  return value;
}
