import { describe, expect, it } from "vitest";
import { buildOutreachEmail, defaultOutreachCopyFor } from "./outreach-email";

describe("outreach email sequence copy", () => {
  it("uses a distinct final-reminder message with a clear stop point", () => {
    const copy = defaultOutreachCopyFor("venue", "follow_up", "final");
    const email = buildOutreachEmail({
      copy,
      kind: "follow_up",
      followUpStage: "final",
      recipient: {
        audienceType: "venue",
        businessName: "Blackshaw Barns",
        town: "Kilmarnock",
        listingSlug: "blackshaw-barns",
        unsubscribeUrl: "https://www.everaft.co.uk/outreach/unsubscribe?preview=1"
      }
    });

    expect(email.subject).toBe("A final note about Blackshaw Barns on EverAft");
    expect(email.text).toContain("will not send further claim reminders");
    expect(email.html).toContain("A final note from EverAft.");
  });
});
