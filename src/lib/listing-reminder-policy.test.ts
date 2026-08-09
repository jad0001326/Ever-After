import { describe, expect, it } from "vitest";
import { listingReminderBlockedReason } from "./listing-reminder-policy";

const now = new Date("2026-08-09T12:00:00.000Z");
const eligible = {
  recipientIsValid: true,
  isHardSuppressed: false,
  hasPendingWork: false,
  approvedAt: "2026-07-20T12:00:00.000Z",
  lastReminderAt: null,
  now
};

describe("listing reminder policy", () => {
  it("allows an incomplete claimed listing after the onboarding grace period", () => {
    expect(listingReminderBlockedReason(eligible)).toBeNull();
  });

  it("pauses reminders while owner changes are awaiting review", () => {
    expect(listingReminderBlockedReason({ ...eligible, hasPendingWork: true })).toContain("awaiting review");
  });

  it("enforces a seven-day cooldown after a successful reminder", () => {
    expect(listingReminderBlockedReason({ ...eligible, lastReminderAt: "2026-08-04T12:00:00.000Z" })).toContain("less than 7 days");
    expect(listingReminderBlockedReason({ ...eligible, lastReminderAt: "2026-08-02T11:59:59.000Z" })).toBeNull();
  });
});
