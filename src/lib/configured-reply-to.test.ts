import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClaimApprovedEmail } from "@/lib/claim-approved-email";
import { configuredReplyToEmail } from "@/lib/email";
import { buildListingReminderEmail } from "@/lib/listing-reminder-email";
import { buildOutreachEmail, defaultOutreachCopyFor } from "@/lib/outreach-email";

const closedMailbox = "james@everaft.co.uk";

describe("configured reply-to address", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads REPLY_TO_EMAIL, then EMAIL_REPLY_TO, and ignores the closed mailbox and placeholders", () => {
    expect(configuredReplyToEmail()).toBeNull();

    vi.stubEnv("EMAIL_REPLY_TO", "Studio <studio@everaft.co.uk>");
    expect(configuredReplyToEmail()).toBe("studio@everaft.co.uk");

    vi.stubEnv("REPLY_TO_EMAIL", "hello@everaft.co.uk");
    expect(configuredReplyToEmail()).toBe("hello@everaft.co.uk");

    for (const value of ["", "not-an-email", "replies@example.com", "hello@yourdomain.com", closedMailbox, "REPLY_TO_EMAIL"]) {
      vi.stubEnv("REPLY_TO_EMAIL", value);
      expect(configuredReplyToEmail()).toBeNull();
    }
  });

  it("uses the configured address in each public signature and mailto", () => {
    vi.stubEnv("REPLY_TO_EMAIL", "hello@everaft.co.uk");

    for (const email of publicEmails()) {
      expect(email.text).toContain("\nhello@everaft.co.uk\n");
      expect(email.html).toContain('href="mailto:hello@everaft.co.uk"');
      expect(email.html).toContain(">hello@everaft.co.uk</a>");
      expect(email.text).not.toContain(closedMailbox);
      expect(email.html).not.toContain(closedMailbox);
    }
  });

  it("omits the reply line when the address is unset or only a placeholder", () => {
    for (const value of [undefined, "replies@example.com", closedMailbox, "not-an-email"] as const) {
      if (value) vi.stubEnv("REPLY_TO_EMAIL", value);
      else vi.unstubAllEnvs();

      for (const email of publicEmails()) {
        expect(email.text).not.toContain(closedMailbox);
        expect(email.text).not.toContain("example.com");
        expect(email.text).not.toContain("yourdomain.com");
        expect(email.text).not.toContain("not-an-email");
        expect(email.html).not.toContain("mailto:");
        expect(email.html).not.toContain("Reply to");
        expect(email.html).not.toContain(closedMailbox);
      }
    }
  });
});

function publicEmails() {
  return [
    buildOutreachEmail({
      copy: defaultOutreachCopyFor("venue", "initial_invite"),
      kind: "initial_invite",
      recipient: {
        audienceType: "venue",
        supplierCategorySlug: null,
        businessName: "Blackshaw Barns",
        town: "Kilmarnock",
        listingSlug: "blackshaw-barns",
        unsubscribeUrl: "https://www.everaft.co.uk/outreach/unsubscribe?preview=1"
      }
    }),
    buildListingReminderEmail({
      venueName: "North House",
      venueSlug: "north-house",
      recipientName: "Ailsa",
      score: 3,
      total: 6,
      missing: ["review summary"]
    }),
    buildClaimApprovedEmail({
      venueName: "North House",
      venueSlug: "north-house",
      claimantName: "Ailsa",
      claimantEmail: "ailsa@north-house.test",
      adminNotes: null
    })
  ];
}
