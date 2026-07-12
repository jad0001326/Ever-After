import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { absoluteUrl } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailNotificationsEnabled, sendEmailBatch, type EmailInput } from "@/lib/email";
import { buildOutreachEmail, type OutreachCopy } from "@/lib/outreach-email";
import { approvalFingerprint, createOutreachApprovalToken, verifyOutreachApprovalToken } from "@/lib/outreach-approval";
import type {
  MissingOutreachContact,
  OutreachAudienceFilter,
  OutreachCandidate,
  OutreachPreviewInput,
  ResearchedOutreachContact
} from "@/lib/outreach-types";
import type { Database, Json } from "@/types/database";

type Campaign = Database["public"]["Tables"]["outreach_campaigns"]["Row"];
type CampaignRecipient = Database["public"]["Tables"]["outreach_campaign_recipients"]["Row"];
type SuppressionReason = Database["public"]["Tables"]["outreach_suppressions"]["Row"]["reason"];

type VenueRow = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  | "id"
  | "slug"
  | "name"
  | "town"
  | "region"
  | "country"
  | "official_website_url"
  | "vendor_contact_email"
  | "vendor_contact_source_url"
  | "invite_status"
  | "invite_sent_at"
>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maxCampaignRecipients = 100;

export type OutreachCandidateResult = {
  candidates: OutreachCandidate[];
  excluded: {
    invalidEmail: number;
    missingEmail: number;
    duplicateEmail: number;
    suppressed: number;
    unverifiedContact: number;
    overLimit: number;
  };
};

export type CampaignSendSummary = {
  campaignId: string;
  status: Campaign["status"];
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
};

export async function listOutreachCandidates(
  filter: OutreachAudienceFilter,
  researchedContacts: ResearchedOutreachContact[] = []
): Promise<OutreachCandidateResult> {
  const supabase = requireAdminClient();
  const limit = clampInteger(filter.limit ?? maxCampaignRecipients, 1, maxCampaignRecipients);
  const country = filter.country?.trim() || "Scotland";
  let query = supabase
    .from("venues")
    .select("id, slug, name, town, region, country, official_website_url, vendor_contact_email, vendor_contact_source_url, invite_status, invite_sent_at")
    .eq("is_claimed", false)
    .eq("listing_status", "published")
    .eq("country", country)
    .order("name", { ascending: true })
    .limit(1000);

  if (filter.region?.trim()) query = query.ilike("region", filter.region.trim());
  if (filter.venueIds?.length) query = query.in("id", Array.from(new Set(filter.venueIds)).slice(0, maxCampaignRecipients));

  if (filter.kind === "follow_up") {
    const days = clampInteger(filter.followUpAfterDays ?? 7, 1, 90);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.eq("invite_status", "sent").lt("invite_sent_at", cutoff);
  } else {
    query = query.eq("invite_status", "not_sent");
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load outreach candidates: ${error.message}`);
  const venues = (data ?? []) as VenueRow[];
  const researchedByVenue = validateResearchedContacts(researchedContacts, venues);
  const eligibleVenueIds = new Set(venues.map((venue) => venue.id));
  const ineligibleContact = researchedContacts.find((contact) => !eligibleVenueIds.has(contact.venueId));
  if (ineligibleContact) {
    throw new Error(`Venue ${ineligibleContact.venueId} is no longer eligible for this campaign. Refresh the missing-contact list.`);
  }

  const prepared = venues.map((venue) => {
    const researched = researchedByVenue.get(venue.id);
    const storedEmail = normalizeEmail(venue.vendor_contact_email ?? "");
    const storedSourceUrl = venue.vendor_contact_source_url ?? "";
    const storedContactIsTrusted = isTrustedVenueContact(storedEmail, storedSourceUrl, venue);
    if (researched && storedContactIsTrusted) {
      throw new Error(`${venue.name} already has a verified contact email. Refresh the audience before preparing the campaign.`);
    }
    return {
      venue,
      email: researched?.email ?? storedEmail,
      contactSourceUrl: researched?.sourceUrl ?? storedSourceUrl,
      contactWasResearched: Boolean(researched),
      contactTrusted: Boolean(researched) || storedContactIsTrusted
    };
  });
  const normalizedEmails = prepared.map((item) => item.email).filter(isValidOutreachEmail);

  const suppressed = new Set<string>();
  if (normalizedEmails.length > 0) {
    const { data: rows, error: suppressionError } = await supabase
      .from("outreach_suppressions")
      .select("normalized_email")
      .in("normalized_email", Array.from(new Set(normalizedEmails)));
    if (suppressionError) throw new Error(`Could not check the suppression list: ${suppressionError.message}`);
    for (const row of rows ?? []) suppressed.add(row.normalized_email);
  }

  const candidates: OutreachCandidate[] = [];
  const seen = new Set<string>();
  const excluded = { invalidEmail: 0, missingEmail: 0, duplicateEmail: 0, suppressed: 0, unverifiedContact: 0, overLimit: 0 };

  for (const item of prepared) {
    const { venue, email } = item;
    if (!email) {
      excluded.missingEmail += 1;
      continue;
    }
    if (!isValidOutreachEmail(email)) {
      excluded.invalidEmail += 1;
      continue;
    }
    if (!item.contactTrusted) {
      excluded.unverifiedContact += 1;
      continue;
    }
    if (seen.has(email)) {
      excluded.duplicateEmail += 1;
      continue;
    }
    seen.add(email);
    if (suppressed.has(email)) {
      excluded.suppressed += 1;
      continue;
    }
    if (candidates.length >= limit) {
      excluded.overLimit += 1;
      continue;
    }
    candidates.push({
      id: venue.id,
      slug: venue.slug,
      name: venue.name,
      town: venue.town,
      region: venue.region,
      country: venue.country,
      email,
      contactSourceUrl: item.contactSourceUrl,
      contactWasResearched: item.contactWasResearched
    });
  }

  return { candidates, excluded };
}

export async function listMissingOutreachContacts(
  filter: Pick<OutreachAudienceFilter, "country" | "region" | "venueIds" | "limit">
): Promise<{ contacts: MissingOutreachContact[]; missingOfficialWebsite: number; overLimit: number }> {
  const supabase = requireAdminClient();
  const limit = clampInteger(filter.limit ?? maxCampaignRecipients, 1, maxCampaignRecipients);
  const country = filter.country?.trim() || "Scotland";
  let query = supabase
    .from("venues")
    .select("id, slug, name, town, region, country, official_website_url, vendor_contact_email, vendor_contact_source_url")
    .eq("is_claimed", false)
    .eq("listing_status", "published")
    .eq("invite_status", "not_sent")
    .eq("country", country)
    .order("name", { ascending: true })
    .limit(1000);

  if (filter.region?.trim()) query = query.ilike("region", filter.region.trim());
  if (filter.venueIds?.length) query = query.in("id", Array.from(new Set(filter.venueIds)).slice(0, maxCampaignRecipients));

  const { data, error } = await query;
  if (error) throw new Error(`Could not load venues needing contact research: ${error.message}`);
  const contacts: MissingOutreachContact[] = [];
  let missingOfficialWebsite = 0;
  let overLimit = 0;
  for (const venue of data ?? []) {
    if (isTrustedVenueContact(normalizeEmail(venue.vendor_contact_email ?? ""), venue.vendor_contact_source_url ?? "", venue)) {
      continue;
    }
    const website = validPublicUrl(venue.official_website_url);
    if (!website) {
      missingOfficialWebsite += 1;
      continue;
    }
    if (contacts.length >= limit) {
      overLimit += 1;
      continue;
    }
    contacts.push({
      id: venue.id,
      slug: venue.slug,
      name: venue.name,
      town: venue.town,
      region: venue.region,
      country: venue.country,
      officialWebsiteUrl: website
    });
  }
  return { contacts, missingOfficialWebsite, overLimit };
}

export async function createOutreachPreview(input: OutreachPreviewInput) {
  const campaignName = requiredText(input.campaignName, "Campaign name", 120);
  const copy = validateCopy(input.copy);
  const result = await listOutreachCandidates(input.filter, input.researchedContacts);
  if (result.candidates.length === 0) throw new Error("No eligible venues match this campaign.");

  const { token, payload } = createOutreachApprovalToken({
    adminUserId: input.adminUserId,
    campaignName,
    kind: input.filter.kind,
    venueIds: result.candidates.map((candidate) => candidate.id),
    recipients: result.candidates,
    expectedRecipientCount: result.candidates.length,
    filter: { ...input.filter, venueIds: result.candidates.map((candidate) => candidate.id), limit: result.candidates.length },
    copy
  });
  const sample = result.candidates[0];
  const sampleEmail = buildOutreachEmail({
    copy,
    kind: input.filter.kind,
    recipient: {
      businessName: sample.name,
      town: sample.town,
      venueSlug: sample.slug,
      unsubscribeUrl: absoluteUrl("/outreach/unsubscribe?preview=1")
    }
  });

  return {
    campaignName,
    kind: input.filter.kind,
    recipientCount: result.candidates.length,
    recipients: result.candidates,
    excluded: result.excluded,
    subjectPreview: sampleEmail.subject,
    sampleText: sampleEmail.text,
    approvalToken: token,
    expiresAt: new Date(payload.expiresAt * 1000).toISOString()
  };
}

export async function createAdminCampaignDraft({
  adminUserId,
  campaignName,
  copy,
  filter
}: Omit<OutreachPreviewInput, "source" | "researchedContacts">) {
  const result = await listOutreachCandidates(filter);
  if (result.candidates.length === 0) throw new Error("No eligible venues remain after validation and suppression checks.");
  return persistCampaign({
    adminUserId,
    campaignName: requiredText(campaignName, "Campaign name", 120),
    copy: validateCopy(copy),
    filter,
    source: "admin",
    candidates: result.candidates,
    fingerprint: null
  });
}

export async function sendApprovedOutreachCampaign({
  adminUserId,
  approvalToken,
  confirmedRecipientCount
}: {
  adminUserId: string;
  approvalToken: string;
  confirmedRecipientCount: number;
}) {
  assertOutreachSendingConfigured();
  const payload = verifyOutreachApprovalToken(approvalToken, adminUserId);
  if (confirmedRecipientCount !== payload.expectedRecipientCount) {
    throw new Error("The confirmed recipient count does not match the approved preview.");
  }

  const fingerprint = approvalFingerprint(approvalToken);
  const supabase = requireAdminClient();
  const { data: existing } = await supabase
    .from("outreach_campaigns")
    .select("id, status, recipient_count, sent_count, failed_count, skipped_count")
    .eq("approval_fingerprint", fingerprint)
    .maybeSingle();
  if (existing) {
    if (existing.status === "draft") {
      await saveResearchedContacts(payload.recipients, adminUserId);
      return sendCampaignById(existing.id, adminUserId);
    }
    return toSendSummary(existing);
  }

  const researchedContacts = payload.recipients
    .filter((recipient) => recipient.contactWasResearched && recipient.contactSourceUrl)
    .map((recipient) => ({ venueId: recipient.id, email: recipient.email, sourceUrl: recipient.contactSourceUrl! }));
  const result = await listOutreachCandidates(
    {
      ...payload.filter,
      venueIds: payload.venueIds,
      limit: payload.expectedRecipientCount
    },
    researchedContacts
  );
  if (!sameRecipientSnapshot(result.candidates, payload.recipients)) {
    throw new Error("The approved audience changed after preview. Generate a new preview before sending.");
  }

  const campaign = await persistCampaign({
    adminUserId,
    campaignName: payload.campaignName,
    copy: payload.copy,
    filter: payload.filter,
    source: "chatgpt",
    candidates: result.candidates,
    fingerprint
  });
  try {
    await saveResearchedContacts(result.candidates, adminUserId);
  } catch (error) {
    await supabase.from("outreach_campaigns").delete().eq("id", campaign.id);
    throw error;
  }
  return sendCampaignById(campaign.id, adminUserId);
}

export async function sendCampaignById(campaignId: string, adminUserId: string): Promise<CampaignSendSummary> {
  assertOutreachSendingConfigured();

  const supabase = requireAdminClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("outreach_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (campaignError) throw new Error(`Could not load campaign: ${campaignError.message}`);
  if (campaign.status === "sent" || campaign.status === "partially_sent" || campaign.status === "failed") {
    return toSendSummary(campaign);
  }
  if (campaign.status !== "draft") throw new Error(`Campaign cannot be sent while its status is ${campaign.status}.`);

  const now = new Date().toISOString();
  const attempt = campaign.send_attempts + 1;
  const { data: locked, error: lockError } = await supabase
    .from("outreach_campaigns")
    .update({
      status: "sending",
      send_attempts: attempt,
      approved_by: adminUserId,
      approved_at: now,
      started_at: now
    })
    .eq("id", campaignId)
    .eq("status", "draft")
    .eq("send_attempts", campaign.send_attempts)
    .select("*")
    .maybeSingle();
  if (lockError) throw new Error(`Could not approve campaign: ${lockError.message}`);
  if (!locked) throw new Error("This campaign was already approved or is being sent.");

  try {
    const { data: rows, error: recipientError } = await supabase
      .from("outreach_campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .order("business_name", { ascending: true });
    if (recipientError) throw new Error(`Could not load campaign recipients: ${recipientError.message}`);
    const recipients = (rows ?? []) as CampaignRecipient[];

    const suppressedEmails = await currentSuppressions(recipients.map((recipient) => recipient.normalized_email));
    const suppressedRecipients = recipients.filter((recipient) => suppressedEmails.has(recipient.normalized_email));
    const sendable = recipients.filter((recipient) => !suppressedEmails.has(recipient.normalized_email));

    if (suppressedRecipients.length > 0) {
      const suppressionUpdates = await Promise.all(
        suppressedRecipients.map((recipient) =>
          supabase
            .from("outreach_campaign_recipients")
            .update({ status: "suppressed", error_message: "Address is on the EverAft suppression list." })
            .eq("id", recipient.id)
            .eq("status", "pending")
        )
      );
      const suppressionError = suppressionUpdates.find((result) => result.error)?.error;
      if (suppressionError) throw new Error(`Could not apply the suppression list: ${suppressionError.message}`);
    }

    const prepared = sendable.map((recipient) => {
      const token = randomBytes(32).toString("base64url");
      const unsubscribeUrl = absoluteUrl(`/outreach/unsubscribe?id=${encodeURIComponent(recipient.id)}&token=${encodeURIComponent(token)}`);
      const oneClickUrl = absoluteUrl(`/api/outreach/unsubscribe?id=${encodeURIComponent(recipient.id)}&token=${encodeURIComponent(token)}`);
      const email = buildOutreachEmail({
        copy: campaignCopy(locked),
        kind: locked.kind,
        recipient: {
          businessName: recipient.business_name,
          town: recipient.town,
          venueSlug: recipient.venue_slug,
          unsubscribeUrl
        }
      });
      const message: EmailInput = {
        to: recipient.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: {
          "List-Unsubscribe": `<${oneClickUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
        },
        tags: [
          { name: "category", value: "venue_outreach" },
          { name: "campaign_id", value: campaignId }
        ]
      };
      return { recipient, tokenHash: hashToken(token), message };
    });

    const tokenUpdates = await Promise.all(
      prepared.map(({ recipient, tokenHash }) =>
        supabase
          .from("outreach_campaign_recipients")
          .update({ unsubscribe_token_hash: tokenHash })
          .eq("id", recipient.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle()
      )
    );
    const tokenError = tokenUpdates.find((result) => result.error)?.error;
    if (tokenError) throw new Error(`Could not prepare unsubscribe links: ${tokenError.message}`);

    let ready = prepared.filter((_, index) => Boolean(tokenUpdates[index]?.data));
    const lastMinuteSuppressions = await currentSuppressions(ready.map(({ recipient }) => recipient.normalized_email));
    if (lastMinuteSuppressions.size > 0) {
      const newlySuppressed = ready.filter(({ recipient }) => lastMinuteSuppressions.has(recipient.normalized_email));
      const lastMinuteUpdates = await Promise.all(
        newlySuppressed.map(({ recipient }) =>
          supabase
            .from("outreach_campaign_recipients")
            .update({ status: "suppressed", error_message: "Address was suppressed before delivery." })
            .eq("id", recipient.id)
            .eq("status", "pending")
        )
      );
      const lastMinuteError = lastMinuteUpdates.find((result) => result.error)?.error;
      if (lastMinuteError) throw new Error(`Could not apply a last-minute suppression: ${lastMinuteError.message}`);
      ready = ready.filter(({ recipient }) => !lastMinuteSuppressions.has(recipient.normalized_email));
    }

    const sendResults = await sendEmailBatch(
      ready.map((item) => item.message),
      `outreach-${campaignId}-${attempt}`
    );
    const sentAt = new Date().toISOString();
    const recipientUpdates = await Promise.all(
      ready.map(({ recipient }, index) => {
        const result = sendResults[index];
        return supabase
          .from("outreach_campaign_recipients")
          .update(
            result.ok
              ? { status: "sent", resend_email_id: result.id ?? null, error_message: null, sent_at: sentAt }
              : { status: "failed", error_message: result.error ?? "Email delivery failed." }
          )
          .eq("id", recipient.id)
          .eq("status", "pending");
      })
    );
    const updateError = recipientUpdates.find((result) => result.error)?.error;
    if (updateError) throw new Error(`Could not record provider delivery IDs: ${updateError.message}`);

    const successfulVenueIds = ready
      .filter((_, index) => sendResults[index]?.ok)
      .map(({ recipient }) => recipient.venue_id)
      .filter((id): id is string => Boolean(id));
    if (successfulVenueIds.length > 0) {
      const { error: venueStatusError } = await supabase
        .from("venues")
        .update({ invite_status: "sent", invite_sent_at: sentAt })
        .in("id", successfulVenueIds);
      if (venueStatusError) console.error("Could not update venue invite statuses", venueStatusError.message);
    }

    return await finalizeCampaign(campaignId);
  } catch (error) {
    await supabase
      .from("outreach_campaigns")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", campaignId)
      .eq("status", "sending");
    throw error;
  }
}

export async function listRecentOutreachCampaigns(limit = 12) {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from("outreach_campaigns")
    .select("id, name, kind, source, status, recipient_count, sent_count, failed_count, skipped_count, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(clampInteger(limit, 1, 50));
  if (error) throw new Error(`Could not load campaigns: ${error.message}`);
  return data ?? [];
}

export async function getOutreachCampaign(campaignId: string) {
  const supabase = requireAdminClient();
  const [{ data: campaign, error: campaignError }, { data: recipients, error: recipientError }] = await Promise.all([
    supabase.from("outreach_campaigns").select("*").eq("id", campaignId).single(),
    supabase
      .from("outreach_campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("business_name", { ascending: true })
  ]);
  if (campaignError) throw new Error(`Could not load campaign: ${campaignError.message}`);
  if (recipientError) throw new Error(`Could not load recipients: ${recipientError.message}`);
  return { campaign, recipients: (recipients ?? []) as CampaignRecipient[] };
}

export async function unsubscribeOutreachRecipient(recipientId: string, token: string) {
  if (recipientId.length > 64 || token.length < 32 || token.length > 200) return { ok: false as const };
  const supabase = requireAdminClient();
  const { data: recipient, error } = await supabase
    .from("outreach_campaign_recipients")
    .select("id, email, normalized_email, unsubscribe_token_hash")
    .eq("id", recipientId)
    .single();
  if (error || !recipient.unsubscribe_token_hash || !validTokenHash(token, recipient.unsubscribe_token_hash)) {
    return { ok: false as const };
  }

  const { error: suppressionError } = await supabase
    .from("outreach_suppressions")
    .upsert({ email: recipient.email, reason: "unsubscribed", source: "recipient" }, { onConflict: "normalized_email" });
  if (suppressionError) throw new Error(`Could not save the unsubscribe request: ${suppressionError.message}`);
  await supabase
    .from("outreach_campaign_recipients")
    .update({ status: "unsubscribed", error_message: null })
    .eq("normalized_email", recipient.normalized_email)
    .in("status", ["pending", "sent", "delivered"]);
  return { ok: true as const };
}

export async function recordOutreachRecipientAction({
  action,
  adminUserId,
  recipientId
}: {
  action: "replied" | "suppress";
  adminUserId: string;
  recipientId: string;
}) {
  const supabase = requireAdminClient();
  const { data: recipient, error } = await supabase
    .from("outreach_campaign_recipients")
    .select("id, venue_id, email, normalized_email")
    .eq("id", recipientId)
    .single();
  if (error) throw new Error(`Could not load the campaign recipient: ${error.message}`);

  if (action === "suppress") {
    const { error: suppressionError } = await supabase
      .from("outreach_suppressions")
      .upsert(
        { email: recipient.email, reason: "manual", source: `admin:${adminUserId}` },
        { onConflict: "normalized_email", ignoreDuplicates: true }
      );
    if (suppressionError) throw new Error(`Could not suppress the address: ${suppressionError.message}`);
    const { error: recipientError } = await supabase
      .from("outreach_campaign_recipients")
      .update({ status: "suppressed", error_message: "Manually suppressed by an EverAft administrator." })
      .eq("normalized_email", recipient.normalized_email)
      .in("status", ["pending", "sent", "delivered", "failed", "replied"]);
    if (recipientError) throw new Error(`Could not update recipient records: ${recipientError.message}`);
    return;
  }

  const { data: replied, error: replyError } = await supabase
    .from("outreach_campaign_recipients")
    .update({ status: "replied", error_message: null })
    .eq("id", recipient.id)
    .in("status", ["sent", "delivered"])
    .select("id")
    .maybeSingle();
  if (replyError) throw new Error(`Could not record the reply: ${replyError.message}`);
  if (!replied) throw new Error("The recipient status changed before the reply could be recorded. Refresh this campaign.");
  if (recipient.venue_id) {
    const { error: venueError } = await supabase.from("venues").update({ invite_status: "replied" }).eq("id", recipient.venue_id);
    if (venueError) throw new Error(`Could not update the venue reply status: ${venueError.message}`);
  }
}

export async function processResendOutreachEvent({
  eventId,
  eventType,
  eventCreatedAt,
  resendEmailId
}: {
  eventId: string;
  eventType: string;
  eventCreatedAt?: string;
  resendEmailId: string;
}) {
  const supabase = requireAdminClient();
  const { data: existing } = await supabase.from("outreach_email_events").select("id").eq("id", eventId).maybeSingle();
  if (existing) return;

  const { data: recipient } = await supabase
    .from("outreach_campaign_recipients")
    .select("id, venue_id, email")
    .eq("resend_email_id", resendEmailId)
    .maybeSingle();
  if (!recipient) return;

  const update: Database["public"]["Tables"]["outreach_campaign_recipients"]["Update"] = {};
  let suppressionReason: SuppressionReason | null = null;
  if (eventType === "email.delivered") {
    update.status = "delivered";
    update.delivered_at = eventCreatedAt ?? new Date().toISOString();
  } else if (eventType === "email.bounced") {
    update.status = "bounced";
    suppressionReason = "bounced";
  } else if (eventType === "email.complained") {
    update.status = "complained";
    suppressionReason = "complained";
  } else if (eventType === "email.suppressed") {
    update.status = "suppressed";
    suppressionReason = "provider_suppressed";
  } else if (eventType === "email.failed") {
    update.status = "failed";
    update.error_message = "Resend reported a delivery failure.";
  }

  if (Object.keys(update).length > 0) {
    await supabase.from("outreach_campaign_recipients").update(update).eq("id", recipient.id);
  }
  if (suppressionReason) {
    await supabase
      .from("outreach_suppressions")
      .upsert({ email: recipient.email, reason: suppressionReason, source: "resend_webhook" }, { onConflict: "normalized_email" });
  }
  if (recipient.venue_id && (eventType === "email.bounced" || eventType === "email.suppressed")) {
    await supabase.from("venues").update({ invite_status: "bounced" }).eq("id", recipient.venue_id);
  }

  await supabase.from("outreach_email_events").insert({
    id: eventId,
    resend_email_id: resendEmailId,
    event_type: eventType,
    event_created_at: eventCreatedAt ?? null
  });
}

async function persistCampaign({
  adminUserId,
  campaignName,
  candidates,
  copy,
  filter,
  fingerprint,
  source
}: {
  adminUserId: string;
  campaignName: string;
  candidates: OutreachCandidate[];
  copy: OutreachCopy;
  filter: OutreachAudienceFilter;
  fingerprint: string | null;
  source: "admin" | "chatgpt";
}) {
  const supabase = requireAdminClient();
  const { data: campaign, error } = await supabase
    .from("outreach_campaigns")
    .insert({
      name: campaignName,
      kind: filter.kind,
      source,
      status: "draft",
      subject: copy.subject,
      preheader: copy.preheader,
      intro_text: copy.introText,
      offer_text: copy.offerText,
      audience_filter: filter as Json,
      approval_fingerprint: fingerprint,
      recipient_count: candidates.length,
      created_by: adminUserId
    })
    .select("*")
    .single();
  if (error) throw new Error(`Could not create campaign: ${error.message}`);

  const { error: recipientError } = await supabase.from("outreach_campaign_recipients").insert(
    candidates.map((candidate) => ({
      campaign_id: campaign.id,
      venue_id: candidate.id,
      venue_slug: candidate.slug,
      business_name: candidate.name,
      town: candidate.town,
      region: candidate.region,
      email: candidate.email,
      contact_source_url: candidate.contactSourceUrl,
      status: "pending" as const
    }))
  );
  if (recipientError) {
    await supabase.from("outreach_campaigns").delete().eq("id", campaign.id);
    throw new Error(`Could not snapshot campaign recipients: ${recipientError.message}`);
  }
  return campaign;
}

async function finalizeCampaign(campaignId: string): Promise<CampaignSendSummary> {
  const supabase = requireAdminClient();
  const { data: recipients, error } = await supabase
    .from("outreach_campaign_recipients")
    .select("status")
    .eq("campaign_id", campaignId);
  if (error) throw new Error(`Could not finalize campaign: ${error.message}`);
  const statuses = (recipients ?? []).map((recipient) => recipient.status);
  const sentCount = statuses.filter((status) => status === "sent" || status === "delivered").length;
  const failedCount = statuses.filter((status) => status === "failed" || status === "pending").length;
  const skippedCount = statuses.filter((status) => status === "suppressed" || status === "unsubscribed").length;
  const recipientCount = statuses.length;
  const status: Campaign["status"] = failedCount === 0 ? "sent" : sentCount > 0 ? "partially_sent" : "failed";
  const { data: campaign, error: updateError } = await supabase
    .from("outreach_campaigns")
    .update({
      status,
      sent_count: sentCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      completed_at: new Date().toISOString()
    })
    .eq("id", campaignId)
    .select("id, status, recipient_count, sent_count, failed_count, skipped_count")
    .single();
  if (updateError) throw new Error(`Could not update campaign totals: ${updateError.message}`);
  return toSendSummary(campaign);
}

async function currentSuppressions(emails: string[]) {
  const supabase = requireAdminClient();
  if (emails.length === 0) return new Set<string>();
  const { data, error } = await supabase
    .from("outreach_suppressions")
    .select("normalized_email")
    .in("normalized_email", Array.from(new Set(emails)));
  if (error) throw new Error(`Could not re-check the suppression list: ${error.message}`);
  return new Set((data ?? []).map((row) => row.normalized_email));
}

function validateResearchedContacts(contacts: ResearchedOutreachContact[], venues: VenueRow[]) {
  if (contacts.length > maxCampaignRecipients) throw new Error(`No more than ${maxCampaignRecipients} researched contacts can be approved at once.`);
  const venuesById = new Map(venues.map((venue) => [venue.id, venue]));
  const byVenue = new Map<string, { email: string; sourceUrl: string }>();
  const emails = new Set<string>();
  for (const contact of contacts) {
    if (byVenue.has(contact.venueId)) throw new Error(`Venue ${contact.venueId} has more than one researched contact.`);
    const email = normalizeEmail(contact.email);
    if (!isValidOutreachEmail(email) || email.length > 254) throw new Error(`The researched email for venue ${contact.venueId} is invalid or a test address.`);
    if (emails.has(email)) throw new Error(`The researched address ${email} was supplied for more than one venue.`);
    const venue = venuesById.get(contact.venueId);
    if (!venue) continue;
    const sourceUrl = validateContactSourceUrl(contact.sourceUrl, venue.official_website_url, venue.name);
    byVenue.set(contact.venueId, { email, sourceUrl });
    emails.add(email);
  }
  return byVenue;
}

function validateContactSourceUrl(sourceValue: string, websiteValue: string | null, businessName: string) {
  const sourceUrl = validPublicUrl(sourceValue);
  if (!sourceUrl || !hasOfficialContactSource(sourceUrl, websiteValue)) {
    throw new Error(`The contact source for ${businessName} must be a public page on its official website.`);
  }
  return sourceUrl;
}

function isTrustedVenueContact(
  email: string,
  sourceValue: string | null | undefined,
  venue: Pick<VenueRow, "official_website_url">
) {
  return isValidOutreachEmail(email) && hasOfficialContactSource(sourceValue, venue.official_website_url);
}

function hasOfficialContactSource(sourceValue: string | null | undefined, websiteValue: string | null | undefined) {
  const sourceUrl = validPublicUrl(sourceValue);
  const websiteUrl = validPublicUrl(websiteValue);
  if (!sourceUrl || !websiteUrl) return false;
  const sourceHost = normalizedHostname(sourceUrl);
  const websiteHost = normalizedHostname(websiteUrl);
  return sourceHost === websiteHost || sourceHost.endsWith(`.${websiteHost}`) || websiteHost.endsWith(`.${sourceHost}`);
}

function validPublicUrl(value: string | null | undefined) {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".local")) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizedHostname(value: string) {
  return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
}

function sameRecipientSnapshot(current: OutreachCandidate[], approved: OutreachCandidate[]) {
  const snapshot = (recipients: OutreachCandidate[]) =>
    recipients
      .map((recipient) => ({
        id: recipient.id,
        slug: recipient.slug,
        name: recipient.name,
        town: recipient.town,
        region: recipient.region,
        country: recipient.country,
        email: normalizeEmail(recipient.email),
        contactSourceUrl: recipient.contactSourceUrl,
        contactWasResearched: recipient.contactWasResearched
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  return JSON.stringify(snapshot(current)) === JSON.stringify(snapshot(approved));
}

async function saveResearchedContacts(candidates: OutreachCandidate[], adminUserId: string) {
  const researched = candidates.filter((candidate) => candidate.contactWasResearched && candidate.contactSourceUrl);
  if (researched.length === 0) return;
  const supabase = requireAdminClient();
  for (const candidate of researched) {
    const { data: venue, error: loadError } = await supabase.from("venues").select("vendor_contact_email").eq("id", candidate.id).single();
    if (loadError) throw new Error(`Could not verify the researched contact for ${candidate.name}: ${loadError.message}`);
    const storedEmail = normalizeEmail(venue.vendor_contact_email ?? "");
    if (storedEmail && storedEmail !== normalizeEmail(candidate.email)) {
      throw new Error(`The contact for ${candidate.name} changed before approval. Generate a fresh preview.`);
    }
    let update = supabase
      .from("venues")
      .update({
        vendor_contact_email: candidate.email,
        vendor_contact_source_url: candidate.contactSourceUrl,
        vendor_contact_verified_at: new Date().toISOString(),
        vendor_contact_verified_by: adminUserId
      })
      .eq("id", candidate.id);
    update = venue.vendor_contact_email == null
      ? update.is("vendor_contact_email", null)
      : update.eq("vendor_contact_email", venue.vendor_contact_email);
    const { data, error } = await update.select("id").maybeSingle();
    if (error) throw new Error(`Could not save the researched contact for ${candidate.name}: ${error.message}`);
    if (!data) throw new Error(`The contact for ${candidate.name} changed before approval. Generate a fresh preview.`);
  }
}

function assertOutreachSendingConfigured() {
  if (process.env.OUTREACH_SENDING_ENABLED !== "true") {
    throw new Error("Outreach sending is disabled. Set OUTREACH_SENDING_ENABLED=true only after domain and test-email checks are complete.");
  }
  if (!emailNotificationsEnabled()) throw new Error("Resend is not configured for this deployment.");
  if (!process.env.RESEND_WEBHOOK_SECRET) throw new Error("RESEND_WEBHOOK_SECRET is required before outreach sending can be enabled.");
  if (!process.env.REPLY_TO_EMAIL && !process.env.EMAIL_REPLY_TO) throw new Error("A monitored REPLY_TO_EMAIL is required before outreach sending can be enabled.");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const url = new URL(siteUrl ?? "");
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid protocol");
    if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || url.hostname === "localhost")) throw new Error("not production HTTPS");
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be the deployed HTTPS site before outreach sending can be enabled.");
  }
}

function campaignCopy(campaign: Pick<Campaign, "subject" | "preheader" | "intro_text" | "offer_text">): OutreachCopy {
  return {
    subject: campaign.subject,
    preheader: campaign.preheader,
    introText: campaign.intro_text,
    offerText: campaign.offer_text
  };
}

function validateCopy(copy: OutreachCopy): OutreachCopy {
  return {
    subject: requiredText(copy.subject, "Subject", 160),
    preheader: requiredText(copy.preheader, "Preheader", 220),
    introText: requiredText(copy.introText, "Introduction", 2000, 20),
    offerText: requiredText(copy.offerText, "Offer", 1000, 10)
  };
}

function requiredText(value: string, label: string, maxLength: number, minLength = 1) {
  const normalized = value.trim();
  if (normalized.length < minLength) throw new Error(`${label} must contain at least ${minLength} characters.`);
  if (normalized.length > maxLength) throw new Error(`${label} cannot exceed ${maxLength} characters.`);
  return normalized;
}

function requireAdminClient() {
  const client = createAdminClient();
  if (!client) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for outreach campaigns.");
  return client;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidOutreachEmail(email: string) {
  if (!emailPattern.test(email)) return false;
  const [localPart, domain] = email.split("@");
  const normalizedLocalPart = localPart.replace(/[+._-].*$/, "");
  const placeholderLocalParts = new Set(["test", "testing", "sample", "example", "xxx", "dummy", "fake"]);
  const placeholderDomains = new Set(["example.com", "test.com", "invalid"]);
  return !placeholderLocalParts.has(normalizedLocalPart) && !placeholderDomains.has(domain);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function validTokenHash(token: string, expectedHash: string) {
  const supplied = Buffer.from(hashToken(token));
  const expected = Buffer.from(expectedHash);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function toSendSummary(campaign: Pick<Campaign, "id" | "status" | "recipient_count" | "sent_count" | "failed_count" | "skipped_count">): CampaignSendSummary {
  return {
    campaignId: campaign.id,
    status: campaign.status,
    recipientCount: campaign.recipient_count,
    sentCount: campaign.sent_count,
    failedCount: campaign.failed_count,
    skippedCount: campaign.skipped_count
  };
}
