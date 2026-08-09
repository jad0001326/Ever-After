import { afterEach, describe, expect, it, vi } from "vitest";
import { buildListingReminderEmail } from "./listing-reminder-email";

describe("listing reminder email", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("matches the invitation branding and personalises the outstanding checks", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.everaft.co.uk");

    const email = buildListingReminderEmail({
      venueName: "Barn & <Hall>",
      venueSlug: "barn-and-hall",
      recipientName: "Ailsa",
      score: 3,
      total: 6,
      missing: ["add official gallery", "submit approved photography", "review description"]
    });

    expect(email.subject).toBe("A quick reminder to finish Barn & <Hall> on EverAft");
    expect(email.preheader).toContain("3 of 6");
    expect(email.text).toContain("Hi Ailsa,");
    expect(email.text).toContain("- Add official gallery");
    expect(email.text).toContain("https://www.everaft.co.uk/vendor");
    expect(email.html).toContain("background:#24432f");
    expect(email.html).toContain("everaft-wedding-reception.png");
    expect(email.html).toContain("Complete your listing");
    expect(email.html).toContain("Barn &amp; &lt;Hall&gt;");
    expect(email.html).toContain("Listing health");
    expect(email.html).toContain("You received this service email");
    expect(email.html).not.toContain("Unsubscribe");
  });

  it("cleans line breaks from the subject and uses a team greeting as fallback", () => {
    const email = buildListingReminderEmail({
      venueName: "North\nHouse",
      venueSlug: "north-house",
      recipientName: " ",
      score: 5,
      total: 6,
      missing: ["review summary"]
    });

    expect(email.subject).toBe("A quick reminder to finish North House on EverAft");
    expect(email.text).toContain("Hi North House team,");
    expect(email.text).toContain("1 suggested next step.");
  });
});
