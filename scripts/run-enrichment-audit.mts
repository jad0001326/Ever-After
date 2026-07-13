import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  auditVenueRecords,
  type AuditableVenue,
  type BusinessStatus,
  type VenueAudit
} from "../src/lib/enrichment/audit.ts";
import {
  isPromotablePublicBusinessEmail,
  normalizeCachedEmailFinding,
  researchOfficialWebsite,
  type WebsiteResearchResult
} from "../src/lib/enrichment/research.ts";
import { hasOfficialContactSource, isValidOutreachEmail, normalizeEmail } from "../src/lib/outreach-validation.ts";

type JsonObject = Record<string, unknown>;

type LiveVenue = AuditableVenue & {
  slug: string;
  name: string;
  type: string;
  town: string;
  region: string;
  country: string;
  summary: string;
  description: string;
  official_gallery_url: string | null;
  image_is_representative: boolean;
  vendor_contact_verified_at?: string | null;
  updated_at?: string | null;
};

type SupplierApplication = {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  website_url: string | null;
  location: string;
  category: string;
  description: string;
  services: string;
  pricing: string | null;
  status: string;
};

type Proposal = {
  entityType: "venue" | "supplier_application";
  entityId: string;
  businessName: string;
  targetTable: "venues" | "business_enrichment_profiles";
  fieldName: string;
  previousValue: unknown;
  proposedValue: unknown;
  sourceUrl: string;
  sourceTitle: string;
  sourceType: string;
  accessedAt: string;
  confidence: "high" | "medium" | "low";
  verificationStatus: string;
  verificationMethod: string;
  reason: string;
  requiresManualReview: boolean;
};

type Args = {
  dryRun: boolean;
  research: boolean;
  concurrency: number;
  maxPages: number;
  timeoutMs: number;
  output: string | null;
  checkpoint: string | null;
  researchLimit: number | null;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
if (!args.dryRun) throw new Error("This command is intentionally dry-run only. Database writes require review through the admin workflow.");

await loadEnv(path.join(root, ".env"));
await loadEnv(path.join(root, ".env.local"));

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve(root, args.output ?? path.join("outputs", "enrichment-audit", timestamp));
const checkpointPath = path.resolve(root, args.checkpoint ?? path.join(outputDir, "research-checkpoint.json"));
await mkdir(outputDir, { recursive: true });

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const publicKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
const auditReadKey = serviceKey ?? publicKey;

const venues = await fetchAll<LiveVenue>("venues", "*", auditReadKey);
const amenityLinks = await fetchAll<{ venue_id: string }>("venue_amenities", "venue_id,amenity_id", auditReadKey, "venue_id.asc,amenity_id.asc");
const amenityCounts = new Map<string, number>();
for (const link of amenityLinks) amenityCounts.set(link.venue_id, (amenityCounts.get(link.venue_id) ?? 0) + 1);
for (const venue of venues) venue.amenity_count = amenityCounts.get(venue.id) ?? 0;

let suppliers: SupplierApplication[] = [];
let suppressions: Array<{ normalized_email: string; reason: string }> = [];
let recipientHistory: Array<{ venue_id: string | null; normalized_email: string; status: string; campaign_id: string }> = [];
const protectedReadWarnings: string[] = [];
const protectedReadState = {
  serviceRoleConfigured: Boolean(serviceKey),
  supplierApplications: false,
  outreachSuppressions: false,
  outreachHistory: false
};
if (serviceKey) {
  const reads = await Promise.allSettled([
    fetchAll<SupplierApplication>("supplier_applications", "*", serviceKey),
    fetchAll<{ normalized_email: string; reason: string }>("outreach_suppressions", "normalized_email,reason", serviceKey),
    fetchAll<{ venue_id: string | null; normalized_email: string; status: string; campaign_id: string }>(
      "outreach_campaign_recipients",
      "venue_id,normalized_email,status,campaign_id",
      serviceKey
    )
  ]);
  if (reads[0].status === "fulfilled") {
    suppliers = reads[0].value;
    protectedReadState.supplierApplications = true;
  } else appendProtectedReadWarning(reads[0], "supplier applications", protectedReadWarnings);
  if (reads[1].status === "fulfilled") {
    suppressions = reads[1].value;
    protectedReadState.outreachSuppressions = true;
  } else appendProtectedReadWarning(reads[1], "outreach suppressions", protectedReadWarnings);
  if (reads[2].status === "fulfilled") {
    recipientHistory = reads[2].value;
    protectedReadState.outreachHistory = true;
  } else appendProtectedReadWarning(reads[2], "outreach history", protectedReadWarnings);
} else {
  protectedReadWarnings.push("SUPABASE_SERVICE_ROLE_KEY is not configured; supplier applications, suppressions, unsubscribe/bounce state, and campaign history were not readable in this dry run.");
}
const outreachSafetyChecksAvailable = protectedReadState.outreachSuppressions && protectedReadState.outreachHistory;
const protectedChecksAvailable = protectedReadState.supplierApplications && outreachSafetyChecksAvailable;

const suppressedEmails = new Set(suppressions.map((row) => normalizeEmail(row.normalized_email)));
const existingOutreachVenueIds = new Set(
  recipientHistory
    .filter((row) => row.venue_id && ["pending", "sent", "delivered", "replied"].includes(row.status))
    .map((row) => row.venue_id!)
);
const initial = auditVenueRecords(venues, { suppressedEmails, existingOutreachVenueIds, maxRecipients: 100 });
const rawResearchResults = args.research ? await runResearch(venues, checkpointPath, args) : await readCheckpoint(checkpointPath);
const venueById = new Map(venues.map((venue) => [venue.id, venue]));
const researchResults = rawResearchResults.map((result): WebsiteResearchResult => {
  const currentOfficialWebsite = venueById.get(result.targetId)?.official_website_url ?? result.officialWebsiteUrl;
  return {
    ...result,
    officialWebsiteUrl: currentOfficialWebsite,
    emails: result.emails.map((finding) => normalizeCachedEmailFinding(finding, currentOfficialWebsite))
  };
});
const proposals = buildProposals(venues, researchResults);
const projectedVenues = applyProjectedContactFields(venues, proposals, researchResults);
const projected = auditVenueRecords(projectedVenues, { suppressedEmails, existingOutreachVenueIds, maxRecipients: 100 });
const historyByVenue = groupHistory(recipientHistory);
const initialAuditById = new Map(initial.audits.map((audit) => [audit.venueId, audit]));
const projectedAuditById = new Map(projected.audits.map((audit) => [audit.venueId, audit]));
const researchById = new Map(researchResults.map((result) => [result.targetId, result]));
const duplicateIds = new Set(projected.duplicateMatches.flatMap((match) => match.venueIds));

const records = venues.map((venue) => {
  const before = initialAuditById.get(venue.id)!;
  const after = projectedAuditById.get(venue.id)!;
  const research = researchById.get(venue.id);
  const history = historyByVenue.get(venue.id) ?? [];
  const venueProposals = proposals.filter((proposal) => proposal.entityId === venue.id);
  const manualContactProposal = venueProposals.some((proposal) =>
    proposal.requiresManualReview && proposal.targetTable === "venues" &&
    ["vendor_contact_email", "vendor_contact_source_url"].includes(proposal.fieldName)
  );
  const unresolvedContact = after.actualEligibilityBlockers.some((blocker) => ["missing_email", "invalid_email", "unverified_contact"].includes(blocker));
  const safetyBlockers = [
    ...(!outreachSafetyChecksAvailable && after.eligibleUnderCurrentRules ? ["protected_suppression_and_history_checks_unavailable"] : []),
    ...(manualContactProposal ? ["manual_contact_proposal_review_required"] : []),
    ...(history.some((item) => ["pending", "sent", "delivered"].includes(item.status)) ? ["existing_or_active_outreach_history"] : []),
    ...(duplicateIds.has(venue.id) ? ["possible_duplicate"] : []),
    ...(["closed", "temporarily_closed", "uncertain"].includes(research?.businessStatus ?? "uncertain") ? [`business_${research?.businessStatus ?? "unchecked"}`] : []),
    ...(unresolvedContact ? ["manual_contact_research_required"] : []),
    ...(research && research.status !== "completed" ? [`research_${research.status}`] : [])
  ];
  return {
    entityType: "venue",
    entityId: venue.id,
    businessName: venue.name,
    slug: venue.slug,
    eligibleUnderCurrentRulesBefore: before.eligibleUnderCurrentRules,
    eligibleUnderCurrentRulesAfter: after.eligibleUnderCurrentRules,
    eligibleBeforeCampaignCap: before.actualEligibilityBlockers.every((blocker) => blocker === "over_campaign_limit"),
    eligibleAfterCampaignCap: after.actualEligibilityBlockers.every((blocker) => blocker === "over_campaign_limit"),
    recommendedForOutreach: after.recommendedForOutreach && safetyBlockers.length === 0,
    exactEligibilityBlockersBefore: before.actualEligibilityBlockers,
    exactEligibilityBlockersAfter: after.actualEligibilityBlockers,
    safetyBlockers,
    dataQualityIssues: after.dataQualityIssues,
    pricingStatus: after.pricing.status,
    businessStatus: research?.businessStatus ?? "unchecked",
    researchStatus: research?.status ?? "not_run",
    publicEmail: projectedVenues.find((item) => item.id === venue.id)?.vendor_contact_email ?? null,
    contactSourceUrl: projectedVenues.find((item) => item.id === venue.id)?.vendor_contact_source_url ?? null,
    historyCount: history.length,
    proposedFieldCount: venueProposals.length,
    requiresManualReview: after.requiresManualReview || safetyBlockers.length > 0
  };
});

const supplierAudit = suppliers.map(auditSupplierApplication);
const allReviewRecords = [...records, ...supplierAudit];
const publicEmailFindings = researchResults.flatMap((result) =>
  result.emails.map((finding) => ({ finding, officialWebsiteUrl: result.officialWebsiteUrl }))
);
const publicEmailsFound = publicEmailFindings.map((item) => item.finding);
const likelyValidEmails = publicEmailFindings
  .filter((item) => isPromotablePublicBusinessEmail(item.finding, item.officialWebsiteUrl))
  .map((item) => item.finding);
const rejectedEmails = publicEmailsFound.filter((item) => item.verification.status === "invalid");
const uniquePublicEmails = new Set(publicEmailsFound.map((item) => normalizeEmail(item.email)));
const uniqueLikelyValidEmails = new Set(likelyValidEmails.map((item) => normalizeEmail(item.email)));
const uniqueRejectedEmails = new Set(rejectedEmails.map((item) => normalizeEmail(item.email)));
const suppressionByEmail = new Map(suppressions.map((row) => [normalizeEmail(row.normalized_email), row.reason]));
const historyByEmail = new Map<string, string[]>();
for (const item of recipientHistory) {
  const email = normalizeEmail(item.normalized_email);
  const statuses = historyByEmail.get(email) ?? [];
  statuses.push(item.status);
  historyByEmail.set(email, statuses);
}
const emailSafety = Object.fromEntries([...uniquePublicEmails].map((email) => {
  const suppressionReason = suppressionByEmail.get(email) ?? null;
  const statuses = historyByEmail.get(email) ?? [];
  const optedOutKnown = suppressionReason === "unsubscribed" || statuses.includes("unsubscribed");
  const hardBounceKnown = suppressionReason === "bounced" || statuses.includes("bounced");
  return [email, {
    checked: outreachSafetyChecksAvailable,
    suppressionChecked: protectedReadState.outreachSuppressions,
    historyChecked: protectedReadState.outreachHistory,
    suppressionReason: protectedReadState.outreachSuppressions ? suppressionReason : null,
    suppressed: protectedReadState.outreachSuppressions ? Boolean(suppressionReason) : null,
    optedOut: optedOutKnown ? true : outreachSafetyChecksAvailable ? false : null,
    hardBounce: hardBounceKnown ? true : outreachSafetyChecksAvailable ? false : null,
    priorOutreach: protectedReadState.outreachHistory ? statuses.length > 0 : null,
    historyStatuses: protectedReadState.outreachHistory ? [...new Set(statuses)] : []
  }];
}));
const newlyEligibleUnderCurrentRules = records.filter((record) => !record.eligibleUnderCurrentRulesBefore && record.eligibleUnderCurrentRulesAfter).length;
const eligibleBeforeCampaignCap = records.filter((record) => record.eligibleBeforeCampaignCap).length;
const eligibleAfterCampaignCap = records.filter((record) => record.eligibleAfterCampaignCap).length;
const newlyEligibleBeforeCampaignCap = records.filter((record) => !record.eligibleBeforeCampaignCap && record.eligibleAfterCampaignCap).length;
const newlyRecommendedSafe = outreachSafetyChecksAvailable
  ? records.filter((record) => !record.eligibleUnderCurrentRulesBefore && record.recommendedForOutreach).length
  : 0;
const pagesChecked = researchResults.reduce((total, item) => total + item.pagesChecked.length, 0);
const requestCount = researchResults.reduce((total, item) => total + item.requestCount, 0);
const retryCount = researchResults.reduce((total, item) => total + item.retryCount, 0);
const pricesFound = researchResults.reduce((total, item) => total + item.publishedPrices.length, 0);
const contactForPrice = researchResults.filter((item) => item.pricingStatus === "contact_for_price").length;
const closed = researchResults.filter((item) => item.businessStatus === "closed").length;
const researchTargetCount = venues.filter(venueNeedsResearch).length;
const researchCompletedCount = researchResults.filter((item) => item.status === "completed").length;
const researchBlockedOrFailed = researchResults.filter((item) => item.status !== "completed").length;
const scopeComplete = protectedChecksAvailable && protectedReadWarnings.length === 0;

const summary = {
  generatedAt: new Date().toISOString(),
  mode: "dry_run",
  databaseWrites: 0,
  emailsSent: 0,
  venuesAudited: venues.length,
  supplierApplicationsAudited: suppliers.length,
  totalRecordsAudited: allReviewRecords.length,
  scopeComplete,
  venueReadMode: serviceKey ? "service_role_all_rows" : "public_rls_rows_only",
  protectedChecksAvailable,
  outreachSafetyChecksAvailable,
  protectedReadState,
  initiallyEligibleUnderCurrentRules: initial.summary.eligibleUnderCurrentRules,
  initiallyIneligibleUnderCurrentRules: initial.summary.ineligibleUnderCurrentRules,
  exactInitialBlockers: initial.summary.actualBlockerCounts,
  qualityIssues: initial.summary.dataQualityIssueCounts,
  projectedEligibleUnderCurrentRules: projected.summary.eligibleUnderCurrentRules,
  newlyEligibleUnderCurrentRules,
  eligibleBeforeCampaignCap,
  projectedEligibleBeforeCampaignCap: eligibleAfterCampaignCap,
  newlyEligibleBeforeCampaignCap,
  newlyRecommendedSafe,
  manualReview: allReviewRecords.filter((record) => record.requiresManualReview).length,
  duplicateSignalGroups: projected.duplicateMatches.length,
  duplicateSignalRows: duplicateIds.size,
  publicEmailsFound: publicEmailsFound.length,
  uniquePublicEmailsFound: uniquePublicEmails.size,
  likelyValidEmails: likelyValidEmails.length,
  uniqueLikelyValidEmails: uniqueLikelyValidEmails.size,
  rejectedEmails: rejectedEmails.length,
  uniqueRejectedEmails: uniqueRejectedEmails.size,
  publishedPricesFound: pricesFound,
  contactForPrice,
  closedBusinessesFound: closed,
  proposals: proposals.length,
  recordsWithProposals: records.filter((record) => record.proposedFieldCount > 0).length,
  research: {
    enabled: args.research || researchResults.length > 0,
    targetsRequired: researchTargetCount,
    targetsAttempted: researchResults.length,
    targetsCompleted: researchCompletedCount,
    targetsBlockedOrFailed: researchBlockedOrFailed,
    pagesChecked,
    httpRequests: requestCount,
    retries: retryCount,
    dnsMxChecks: publicEmailsFound.length,
    paidApiCalls: 0,
    estimatedIncrementalApiCost: "GBP 0.00"
  },
  migrationsRequired: ["supabase/phase10_enrichment_workflow.sql"],
  newEnvironmentVariablesRequired: [],
  warnings: protectedReadWarnings
};

const report = {
  summary,
  exactEligibilityRules: [
    "venue is not claimed",
    "listing_status is published",
    "country is Scotland",
    "invite_status is not_sent for an initial invitation",
    "email is present and passes the existing syntax/test-placeholder validation",
    "contact source URL is on the official website host",
    "email is not duplicated earlier in the candidate batch",
    "email is not suppressed",
    "venue has no active or completed initial-outreach history",
    "candidate is inside the 100-recipient campaign cap"
  ],
  scopeNotes: [
    "Supplier applications are inbound applications, not supplier outreach candidates in the current product.",
    "Missing price and representative imagery are quality issues, not current outreach blockers.",
    "likely_valid candidate counts require visible or mailto publication on an official page, exact official-domain or subdomain association, and syntax/DNS checks; they are not mailbox-level verification.",
    "No proposed field value has been written to Supabase."
  ],
  protectedReadWarnings,
  supplierAudit,
  emailSafety,
  researchResults,
  proposals,
  duplicates: projected.duplicateMatches,
  records: allReviewRecords
};

await writeJson(path.join(outputDir, "audit.json"), report);
await writeJson(path.join(outputDir, "summary.json"), summary);
await writeJsonLines(path.join(outputDir, "proposals.jsonl"), proposals);
await writeCsv(path.join(outputDir, "records.csv"), allReviewRecords);
await writeCsv(path.join(outputDir, "duplicates.csv"), projected.duplicateMatches.map((match) => ({ kind: match.kind, key: match.key, venueIds: match.venueIds.join("|") })));
await writeCsv(path.join(outputDir, "manual-review.csv"), allReviewRecords.filter((record) => record.requiresManualReview));
await writeFile(path.join(outputDir, "README.md"), markdownReport(summary), "utf8");

process.stdout.write(`${JSON.stringify({ outputDir, ...summary }, null, 2)}\n`);

async function runResearch(liveVenues: LiveVenue[], checkpointFile: string, options: Args) {
  const venueById = new Map(liveVenues.map((venue) => [venue.id, venue]));
  const checkpoint = new Map(
    (await readCheckpoint(checkpointFile))
      .filter((result) => checkpointIsFresh(result, venueById.get(result.targetId)))
      .map((result) => [result.targetId, result])
  );
  const allTargets = liveVenues.filter(venueNeedsResearch);
  const targets = allTargets.filter((venue) => !checkpoint.has(venue.id));
  const limited = options.researchLimit == null ? targets : targets.slice(0, options.researchLimit);
  let nextIndex = 0;
  let completedSinceWrite = 0;
  let checkpointWrite = Promise.resolve();
  const queueCheckpointWrite = () => {
    checkpointWrite = checkpointWrite.then(() => atomicWriteJson(checkpointFile, [...checkpoint.values()].sort((left, right) => left.targetId.localeCompare(right.targetId))));
    return checkpointWrite;
  };
  const workers = Array.from({ length: Math.min(options.concurrency, Math.max(1, limited.length)) }, async () => {
    while (nextIndex < limited.length) {
      const index = nextIndex;
      nextIndex += 1;
      const venue = limited[index];
      const result = await researchOfficialWebsite({
        id: venue.id,
        name: venue.name,
        officialWebsiteUrl: venue.official_website_url!,
        existingEmail: venue.vendor_contact_email
      }, {
        maxPages: options.maxPages,
        timeoutMs: options.timeoutMs,
        retries: 2,
        minimumHostDelayMs: 800
      });
      checkpoint.set(venue.id, result);
      completedSinceWrite += 1;
      process.stdout.write(`research ${checkpoint.size}/${allTargets.length} ${venue.name} (${result.status})\n`);
      if (completedSinceWrite >= 5) {
        completedSinceWrite = 0;
        await queueCheckpointWrite();
      }
    }
  });
  await Promise.all(workers);
  await checkpointWrite;
  const results = [...checkpoint.values()].sort((left, right) => left.targetId.localeCompare(right.targetId));
  await atomicWriteJson(checkpointFile, results);
  return results;
}

function venueNeedsResearch(venue: LiveVenue) {
  if (!venue.official_website_url) return false;
  return !venue.vendor_contact_email ||
    !hasOfficialContactSource(venue.vendor_contact_source_url, venue.official_website_url) ||
    venue.price_from == null ||
    venue.price_to == null ||
    venue.latitude == null ||
    venue.longitude == null ||
    !venue.official_gallery_url ||
    !venue.vendor_contact_verified_at ||
    (venue.amenity_count ?? 0) < 1;
}

function checkpointIsFresh(result: WebsiteResearchResult, venue: LiveVenue | undefined) {
  if (!venue?.official_website_url || result.status !== "completed") return false;
  if (normalizedWebsiteKey(result.officialWebsiteUrl) !== normalizedWebsiteKey(venue.official_website_url)) return false;
  const checkedAt = Date.parse(result.checkedAt);
  return Number.isFinite(checkedAt) && Date.now() - checkedAt < 30 * 24 * 60 * 60 * 1000;
}

function normalizedWebsiteKey(value: string) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return value.trim().toLowerCase().replace(/\/$/, "");
  }
}

function buildProposals(liveVenues: LiveVenue[], research: WebsiteResearchResult[]) {
  const venueById = new Map(liveVenues.map((venue) => [venue.id, venue]));
  const proposals: Proposal[] = [];
  for (const result of research) {
    const venue = venueById.get(result.targetId);
    if (!venue || result.status !== "completed") continue;
    const existingEmail = normalizeEmail(venue.vendor_contact_email ?? "");
    const promotableEmails = result.emails.filter((finding) =>
      isPromotablePublicBusinessEmail(finding, venue.official_website_url ?? result.officialWebsiteUrl)
    );
    const matchingExisting = promotableEmails.find((finding) => finding.email === existingEmail);
    const bestEmail = matchingExisting ?? promotableEmails[0];

    if (bestEmail && !existingEmail) {
      proposals.push(proposal(venue, "venues", "vendor_contact_email", null, bestEmail.email, bestEmail.sourceUrl, bestEmail.confidence, bestEmail.verification.status, bestEmail.verification.method, "Public business email visibly published on the official website.", true, result));
    }
    if (bestEmail && (!venue.vendor_contact_source_url || !hasOfficialContactSource(venue.vendor_contact_source_url, venue.official_website_url))) {
      if (!existingEmail || bestEmail.email === existingEmail) {
        proposals.push(proposal(venue, "venues", "vendor_contact_source_url", venue.vendor_contact_source_url, bestEmail.sourceUrl, bestEmail.sourceUrl, bestEmail.confidence, bestEmail.verification.status, bestEmail.verification.method, "Exact official page containing the public business email.", true, result));
      }
    }
    if (result.contactPageUrl) proposals.push(proposal(venue, "business_enrichment_profiles", "contact_page_url", null, result.contactPageUrl, result.contactPageUrl, "high", "verified", "official_site", "Official contact page discovered during the crawl.", false, result));
    if (result.enquiryPageUrl) proposals.push(proposal(venue, "business_enrichment_profiles", "enquiry_page_url", null, result.enquiryPageUrl, result.enquiryPageUrl, "high", "verified", "official_site", "Official enquiry page discovered during the crawl.", false, result));
    if (result.businessStatus !== "uncertain") proposals.push(proposal(venue, "business_enrichment_profiles", "business_status", "uncertain", result.businessStatus, result.pagesChecked[0] ?? venue.official_website_url!, "medium", "verified", "official_site_activity", "Business activity status inferred conservatively from the functioning official website and published booking/enquiry content.", true, result));
    if (result.pricingStatus !== "not_found") {
      const pricing = {
        pricingStatus: result.pricingStatus,
        currency: result.publishedPrices.length ? "GBP" : null,
        startingPrice: result.publishedPrices[0]?.amount ?? null,
        maximumPublishedPrice: result.publishedPrices.at(-1)?.amount ?? null,
        pricingBasis: "unspecified",
        packages: result.publishedPrices.map((item) => ({ price: item.amount, context: item.context, sourceUrl: item.sourceUrl })),
        sourceUrl: result.publishedPrices[0]?.sourceUrl ?? result.pagesChecked[0] ?? venue.official_website_url,
        lastVerifiedAt: result.checkedAt
      };
      proposals.push(proposal(venue, "business_enrichment_profiles", "structured_pricing", {}, pricing, String(pricing.sourceUrl), "medium", "verified", "official_site", "Structured copy of pricing visibly published by the business, or an official contact-for-price instruction.", true, result));
      const comparableVenuePrice = result.publishedPrices.find((item) =>
        /\b(?:venue\s+hire|wedding\s+package|package\s+price|per\s+event|exclusive\s+use)\b/i.test(item.context) &&
        !/\bper\s+(?:person|head|guest|room|night|hour)\b/i.test(item.context)
      );
      if (venue.price_from == null && comparableVenuePrice) {
        proposals.push(proposal(venue, "venues", "price_from", null, comparableVenuePrice.amount, comparableVenuePrice.sourceUrl, "medium", "verified", "official_site", "Explicit comparable venue-hire, exclusive-use or wedding-package price found on an official page; requires human context review before applying.", true, result));
      }
    }
  }
  return deduplicateProposals(proposals);
}

function proposal(
  venue: LiveVenue,
  targetTable: Proposal["targetTable"],
  fieldName: string,
  previousValue: unknown,
  proposedValue: unknown,
  sourceUrl: string,
  confidence: Proposal["confidence"],
  verificationStatus: string,
  verificationMethod: string,
  reason: string,
  requiresManualReview: boolean,
  research: WebsiteResearchResult
): Proposal {
  return {
    entityType: "venue",
    entityId: venue.id,
    businessName: venue.name,
    targetTable,
    fieldName,
    previousValue,
    proposedValue,
    sourceUrl,
    sourceTitle: `${venue.name} official website`,
    sourceType: "official_website",
    accessedAt: research.checkedAt,
    confidence,
    verificationStatus,
    verificationMethod,
    reason,
    requiresManualReview
  };
}

function deduplicateProposals(proposals: Proposal[]) {
  const seen = new Set<string>();
  return proposals.filter((item) => {
    const key = createHash("sha256").update(JSON.stringify([item.entityType, item.entityId, item.targetTable, item.fieldName, item.proposedValue, item.sourceUrl])).digest("hex");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyProjectedContactFields(liveVenues: LiveVenue[], proposals: Proposal[], research: WebsiteResearchResult[]) {
  const proposalsByVenue = new Map<string, Proposal[]>();
  for (const item of proposals) {
    const list = proposalsByVenue.get(item.entityId) ?? [];
    list.push(item);
    proposalsByVenue.set(item.entityId, list);
  }
  const researchById = new Map(research.map((item) => [item.targetId, item]));
  return liveVenues.map((venue): LiveVenue => {
    const next = { ...venue };
    for (const item of proposalsByVenue.get(venue.id) ?? []) {
      if (item.targetTable === "venues" && item.fieldName === "vendor_contact_email" && sameProjectedValue(next.vendor_contact_email, item.previousValue)) next.vendor_contact_email = String(item.proposedValue);
      if (item.targetTable === "venues" && item.fieldName === "vendor_contact_source_url" && sameProjectedValue(next.vendor_contact_source_url, item.previousValue)) next.vendor_contact_source_url = String(item.proposedValue);
      if (item.targetTable === "venues" && item.fieldName === "price_from" && sameProjectedValue(next.price_from, item.previousValue)) next.price_from = Number(item.proposedValue);
    }
    next.business_status = researchById.get(venue.id)?.businessStatus as BusinessStatus | undefined;
    return next;
  });
}

function sameProjectedValue(current: unknown, previous: unknown) {
  return JSON.stringify(current ?? null) === JSON.stringify(previous ?? null);
}

function auditSupplierApplication(application: SupplierApplication) {
  const missing = [
    !application.business_name.trim() ? "business_name" : null,
    !application.owner_name.trim() ? "owner_name" : null,
    !isValidOutreachEmail(normalizeEmail(application.email)) ? "valid_email" : null,
    !application.phone.trim() ? "phone" : null,
    !application.website_url ? "website" : null,
    !application.location.trim() ? "location" : null,
    !application.category.trim() ? "category" : null,
    !application.description.trim() ? "description" : null,
    !application.services.trim() ? "services" : null,
    !application.pricing ? "pricing" : null
  ].filter(Boolean);
  return {
    entityType: "supplier_application",
    entityId: application.id,
    businessName: application.business_name,
    slug: null,
    eligibleUnderCurrentRulesBefore: false,
    eligibleUnderCurrentRulesAfter: false,
    eligibleBeforeCampaignCap: false,
    eligibleAfterCampaignCap: false,
    recommendedForOutreach: false,
    exactEligibilityBlockersBefore: ["supplier_outreach_not_supported"],
    exactEligibilityBlockersAfter: ["supplier_outreach_not_supported"],
    safetyBlockers: ["supplier_outreach_not_supported"],
    dataQualityIssues: missing.map((field) => `missing_${field}`),
    pricingStatus: application.pricing ? "unstructured" : "not_found",
    businessStatus: "unchecked",
    researchStatus: "summary_only",
    publicEmail: application.email,
    contactSourceUrl: application.website_url,
    historyCount: 0,
    proposedFieldCount: 0,
    requiresManualReview: true,
    applicationStatus: application.status,
    outreachReason: "Supplier applications are inbound records and are not part of the current outreach candidate model."
  };
}

function groupHistory(rows: Array<{ venue_id: string | null; normalized_email: string; status: string; campaign_id: string }>) {
  const map = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.venue_id) continue;
    const list = map.get(row.venue_id) ?? [];
    list.push(row);
    map.set(row.venue_id, list);
  }
  return map;
}

async function fetchAll<T>(table: string, select: string, key: string, orderColumn = "id") {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set("select", select);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("order", orderColumn.includes(".") ? orderColumn : `${orderColumn}.asc`);
    const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(`${table} read failed (${response.status}): ${await response.text()}`);
    const page = await response.json() as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function loadEnv(filePath: string) {
  try {
    const text = await readFile(filePath, "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] ??= value;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function parseArgs(values: string[]): Args {
  const map = new Map<string, string | true>();
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, raw] = value.slice(2).split("=", 2);
    map.set(key, raw ?? true);
  }
  if (map.has("apply")) throw new Error("--apply is not available. Review the dry run in /admin/enrichment before any database change.");
  return {
    dryRun: map.has("dry-run") || !map.has("apply"),
    research: map.has("research"),
    concurrency: boundedNumber(map.get("concurrency"), 4, 1, 8),
    maxPages: boundedNumber(map.get("max-pages"), 5, 1, 10),
    timeoutMs: boundedNumber(map.get("timeout-ms"), 10_000, 1_000, 30_000),
    output: typeof map.get("output") === "string" ? String(map.get("output")) : null,
    checkpoint: typeof map.get("checkpoint") === "string" ? String(map.get("checkpoint")) : null,
    researchLimit: typeof map.get("research-limit") === "string" ? boundedNumber(map.get("research-limit"), 0, 1, 100_000) : null
  };
}

function boundedNumber(value: string | true | undefined, fallback: number, minimum: number, maximum: number) {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.trunc(parsed))) : fallback;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the read-only dry run.`);
  return value;
}

function appendProtectedReadWarning(result: PromiseRejectedResult, label: string, warnings: string[]) {
  warnings.push(`${label} could not be read: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
}

async function readCheckpoint(filePath: string): Promise<WebsiteResearchResult[]> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as WebsiteResearchResult[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function atomicWriteJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeJson(temporary, value);
  await rename(temporary, filePath);
}

async function writeJsonLines(filePath: string, values: unknown[]) {
  await writeFile(filePath, `${values.map((value) => JSON.stringify(value)).join("\n")}${values.length ? "\n" : ""}`, "utf8");
}

async function writeCsv(filePath: string, values: JsonObject[]) {
  if (!values.length) {
    await writeFile(filePath, "", "utf8");
    return;
  }
  const headers = [...new Set(values.flatMap((value) => Object.keys(value)))];
  const lines = [headers.map(csvCell).join(",")];
  for (const value of values) lines.push(headers.map((header) => csvCell(formatCell(value[header]))).join(","));
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatCell(value: unknown) {
  return Array.isArray(value) ? value.join("|") : value && typeof value === "object" ? JSON.stringify(value) : value ?? "";
}

function markdownReport(summary: Record<string, unknown>) {
  return `# EverAft enrichment dry run\n\nGenerated ${summary.generatedAt}. No database writes were made and no emails were sent.\n\n## Headline results\n\n- Venues audited: ${summary.venuesAudited}\n- Supplier applications audited: ${summary.supplierApplicationsAudited}\n- Initially eligible in a 100-recipient campaign preview: ${summary.initiallyEligibleUnderCurrentRules}\n- Initially ineligible: ${summary.initiallyIneligibleUnderCurrentRules}\n- Projected eligible in the first campaign preview: ${summary.projectedEligibleUnderCurrentRules}\n- Newly eligible in that preview: ${summary.newlyEligibleUnderCurrentRules}\n- Projected eligible before the per-campaign cap: ${summary.projectedEligibleBeforeCampaignCap}\n- Newly eligible before the per-campaign cap: ${summary.newlyEligibleBeforeCampaignCap}\n- Newly recommended safe after all available checks: ${summary.newlyRecommendedSafe}\n- Unique public emails found: ${summary.uniquePublicEmailsFound}\n- Unique likely-valid emails after syntax and DNS/MX checks: ${summary.uniqueLikelyValidEmails}\n- Unique rejected email findings: ${summary.uniqueRejectedEmails}\n- Published prices found: ${summary.publishedPricesFound}\n- Contact-for-price records: ${summary.contactForPrice}\n- Duplicate signal groups: ${summary.duplicateSignalGroups}\n- Manual review records: ${summary.manualReview}\n\n## Safety boundary\n\nReview proposals and apply phase10 before loading them into the admin queue. Approval only changes allowlisted business fields; it never sends email or changes invite, listing, claim, consent, suppression, or outreach-history state.\n`;
}
