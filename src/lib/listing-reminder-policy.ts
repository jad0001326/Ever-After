export const LISTING_REMINDER_COOLDOWN_DAYS = 7;
export const LISTING_REMINDER_AUDIT_ACTION = "listing_reminder_sent";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type ListingReminderPolicyInput = {
  recipientIsValid: boolean;
  isHardSuppressed: boolean;
  hasPendingWork: boolean;
  approvedAt: string | null;
  lastReminderAt: string | null;
  now?: Date;
};

export function listingReminderBlockedReason({
  recipientIsValid,
  isHardSuppressed,
  hasPendingWork,
  approvedAt,
  lastReminderAt,
  now = new Date()
}: ListingReminderPolicyInput) {
  if (!recipientIsValid) return "The registered account does not have a valid email address.";
  if (isHardSuppressed) return "This address is suppressed after a bounce, complaint or manual block.";
  if (hasPendingWork) return "Listing changes or photography are already awaiting review.";
  if (withinCooldown(approvedAt, now)) return "The claim was approved less than 7 days ago.";
  if (withinCooldown(lastReminderAt, now)) return "A listing reminder was sent less than 7 days ago.";
  return null;
}

function withinCooldown(value: string | null, now: Date) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return now.getTime() - timestamp < LISTING_REMINDER_COOLDOWN_DAYS * DAY_IN_MS;
}
