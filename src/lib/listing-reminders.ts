import "server-only";
import { sendEmail, isValidEmailRecipient } from "@/lib/email";
import { getVenueListingHealth } from "@/lib/listing-health";
import { buildListingReminderEmail } from "@/lib/listing-reminder-email";
import {
  LISTING_REMINDER_AUDIT_ACTION,
  listingReminderBlockedReason
} from "@/lib/listing-reminder-policy";
import { createAdminClient } from "@/lib/supabase/admin";

export type ListingReminderCandidate = {
  id: string;
  claimId: string | null;
  userId: string;
  venueName: string;
  venueSlug: string;
  recipientName: string;
  recipientEmail: string;
  score: number;
  total: number;
  missing: string[];
  approvedAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
  hasPendingWork: boolean;
  blockedReason: string | null;
  eligible: boolean;
};

export type ListingReminderSendSummary = {
  requested: number;
  sent: number;
  failed: number;
  skipped: number;
  trackingFailed: number;
};

export async function listIncompleteListingReminderCandidates(now = new Date()) {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Configure the Supabase service role key before loading listing reminders.");

  const { data: venueRows, error: venueError } = await supabase
    .from("venues")
    .select("id, name, slug, claimed_by, claimed_at, official_website_url, official_gallery_url, vendor_contact_email, image_is_representative, summary, description")
    .eq("is_claimed", true)
    .eq("claim_status", "approved")
    .neq("listing_status", "archived")
    .not("claimed_by", "is", null)
    .order("updated_at", { ascending: false });

  if (venueError) throw new Error(`Could not load claimed listings: ${venueError.message}`);

  const incomplete = (venueRows ?? [])
    .map((venue) => ({ venue, health: getVenueListingHealth(venue) }))
    .filter(({ health }) => health.score < health.total);

  if (incomplete.length === 0) return [] satisfies ListingReminderCandidate[];

  const venueIds = unique(incomplete.map(({ venue }) => venue.id));
  const userIds = unique(incomplete.flatMap(({ venue }) => venue.claimed_by ? [venue.claimed_by] : []));

  const [profilesResult, claimsResult, remindersResult, pendingUpdatesResult, pendingImagesResult] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name").in("id", userIds),
    supabase
      .from("venue_claims")
      .select("id, venue_id, claimant_user_id, claimant_name, claimant_email, reviewed_at")
      .eq("status", "approved")
      .in("venue_id", venueIds)
      .order("reviewed_at", { ascending: false }),
    supabase
      .from("venue_claim_audit_log")
      .select("venue_id, created_at")
      .eq("action", LISTING_REMINDER_AUDIT_ACTION)
      .in("venue_id", venueIds)
      .order("created_at", { ascending: false }),
    supabase.from("vendor_update_requests").select("venue_id").eq("status", "pending").in("venue_id", venueIds),
    supabase.from("venue_image_submissions").select("venue_id").eq("status", "pending").in("venue_id", venueIds)
  ]);

  const loadError = [
    profilesResult.error,
    claimsResult.error,
    remindersResult.error,
    pendingUpdatesResult.error,
    pendingImagesResult.error
  ].find(Boolean);
  if (loadError) throw new Error(`Could not build the listing reminder queue: ${loadError.message}`);

  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const claimsByVenue = groupBy(claimsResult.data ?? [], (claim) => claim.venue_id);
  const remindersByVenue = groupBy(
    (remindersResult.data ?? []).filter((reminder): reminder is { venue_id: string; created_at: string } => Boolean(reminder.venue_id)),
    (reminder) => reminder.venue_id
  );
  const pendingVenueIds = new Set([
    ...(pendingUpdatesResult.data ?? []).map((request) => request.venue_id),
    ...(pendingImagesResult.data ?? []).map((submission) => submission.venue_id)
  ]);

  const prepared = incomplete.map(({ venue, health }) => {
    const userId = venue.claimed_by as string;
    const profile = profiles.get(userId);
    const venueClaims = claimsByVenue.get(venue.id) ?? [];
    const claim = venueClaims.find((item) => item.claimant_user_id === userId) ?? venueClaims[0] ?? null;
    const recipientEmail = profile?.email?.trim() || claim?.claimant_email?.trim() || "";
    const recipientName = profile?.full_name?.trim() || claim?.claimant_name?.trim() || "";
    const history = remindersByVenue.get(venue.id) ?? [];

    return {
      id: venue.id,
      claimId: claim?.id ?? null,
      userId,
      venueName: venue.name,
      venueSlug: venue.slug,
      recipientName,
      recipientEmail,
      score: health.score,
      total: health.total,
      missing: health.missing,
      approvedAt: claim?.reviewed_at ?? venue.claimed_at,
      lastReminderAt: history[0]?.created_at ?? null,
      reminderCount: history.length,
      hasPendingWork: pendingVenueIds.has(venue.id)
    };
  });

  const normalizedEmails = unique(
    prepared
      .map((candidate) => candidate.recipientEmail.trim().toLowerCase())
      .filter(Boolean)
  );
  const { data: suppressions, error: suppressionError } = normalizedEmails.length
    ? await supabase
      .from("outreach_suppressions")
      .select("normalized_email, reason")
      .in("normalized_email", normalizedEmails)
      .neq("reason", "unsubscribed")
    : { data: [], error: null };
  if (suppressionError) throw new Error(`Could not apply email suppressions: ${suppressionError.message}`);
  const hardSuppressed = new Set((suppressions ?? []).map((suppression) => suppression.normalized_email));

  return prepared
    .map((candidate): ListingReminderCandidate => {
      const blockedReason = listingReminderBlockedReason({
        recipientIsValid: isValidEmailRecipient(candidate.recipientEmail),
        isHardSuppressed: hardSuppressed.has(candidate.recipientEmail.trim().toLowerCase()),
        hasPendingWork: candidate.hasPendingWork,
        approvedAt: candidate.approvedAt,
        lastReminderAt: candidate.lastReminderAt,
        now
      });
      return { ...candidate, blockedReason, eligible: blockedReason === null };
    })
    .sort((left, right) =>
      Number(right.eligible) - Number(left.eligible)
      || left.score - right.score
      || left.venueName.localeCompare(right.venueName)
    );
}

export async function sendListingReminders({
  adminUserId,
  venueIds
}: {
  adminUserId: string;
  venueIds: string[];
}): Promise<ListingReminderSendSummary> {
  const requestedIds = unique(venueIds.filter(Boolean)).slice(0, 100);
  const candidates = await listIncompleteListingReminderCandidates();
  const requestedSet = new Set(requestedIds);
  const selected = candidates.filter((candidate) => requestedSet.has(candidate.id) && candidate.eligible);
  const summary: ListingReminderSendSummary = {
    requested: requestedIds.length,
    sent: 0,
    failed: 0,
    skipped: requestedIds.length - selected.length,
    trackingFailed: 0
  };

  if (selected.length === 0) return summary;
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Configure the Supabase service role key before sending listing reminders.");

  for (let index = 0; index < selected.length; index += 5) {
    const batch = selected.slice(index, index + 5);
    const results = await Promise.all(batch.map(async (candidate) => {
      const email = buildListingReminderEmail({
        venueName: candidate.venueName,
        venueSlug: candidate.venueSlug,
        recipientName: candidate.recipientName,
        score: candidate.score,
        total: candidate.total,
        missing: candidate.missing
      });
      const result = await sendEmail({
        to: candidate.recipientEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
        idempotencyKey: `listing-reminder-${candidate.id}-${candidate.reminderCount + 1}`,
        tags: [
          { name: "category", value: "listing_reminder" },
          { name: "venue_id", value: candidate.id }
        ]
      });
      return { candidate, result };
    }));

    const successful = results.filter(({ result }) => result.ok);
    summary.sent += successful.length;
    summary.failed += results.length - successful.length;
    if (successful.length === 0) continue;

    const { error: auditError } = await supabase.from("venue_claim_audit_log").insert(
      successful.map(({ candidate, result }) => ({
        claim_id: candidate.claimId,
        venue_id: candidate.id,
        admin_user_id: adminUserId,
        action: LISTING_REMINDER_AUDIT_ACTION,
        notes: JSON.stringify({
          recipient: candidate.recipientEmail,
          resend_email_id: result.id ?? null,
          listing_health: { score: candidate.score, total: candidate.total },
          missing: candidate.missing
        })
      }))
    );
    if (auditError) {
      console.error("Listing reminders were sent but could not be added to the audit log.", auditError);
      summary.trackingFailed += successful.length;
    }
  }

  return summary;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}
