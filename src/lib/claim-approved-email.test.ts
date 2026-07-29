import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClaimApprovedEmail } from "./claim-approved-email";

describe("claim approved welcome email", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the invitation branding and gives the claimant complete dashboard instructions", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.everaft.co.uk");

    const email = buildClaimApprovedEmail({
      venueName: "Barn & <Hall>",
      venueSlug: "barn-and-hall",
      claimantName: "Ailsa",
      claimantEmail: "ailsa@example.com",
      adminNotes: "Welcome aboard.\nPlease check the gallery link."
    });

    expect(email.subject).toBe("Welcome to EverAft — Barn & <Hall> is now claimed");
    expect(email.preheader).toContain("vendor dashboard");
    expect(email.text).toContain("Hi Ailsa,");
    expect(email.text).toContain("Management access is linked to ailsa@example.com");
    expect(email.text).toContain("https://www.everaft.co.uk/vendor");
    expect(email.text).toContain("https://www.everaft.co.uk/venues/barn-and-hall");
    expect(email.text).toContain("“Request review”");
    expect(email.text).toContain("up to 8 JPEG, PNG or WebP images");
    expect(email.text).toContain("up to 20 MB each");
    expect(email.text).toContain("“Submit [number] for review”");
    expect(email.text).toContain("New, Contacted, Converted or Closed");
    expect(email.text).toContain("We will not announce it unless you confirm.");
    expect(email.text).toContain("Welcome aboard.\nPlease check the gallery link.");

    expect(email.html).toContain("background:#24432f");
    expect(email.html).toContain("border-top:1px solid #bc845f");
    expect(email.html).toContain("everaft-wedding-reception.png");
    expect(email.html).toContain("Open your vendor dashboard");
    expect(email.html).toContain("Barn &amp; &lt;Hall&gt;");
    expect(email.html).toContain("Welcome aboard.<br>Please check the gallery link.");
    expect(email.html).toContain("You received this service email");
    expect(email.html).not.toContain("Unsubscribe");
  });

  it("removes line breaks from the subject and omits an empty admin note", () => {
    const email = buildClaimApprovedEmail({
      venueName: "North\nHouse",
      venueSlug: "north-house",
      claimantName: "",
      claimantEmail: "team@north-house.test",
      adminNotes: "  "
    });

    expect(email.subject).toBe("Welcome to EverAft — North House is now claimed");
    expect(email.text).toContain("Hi North House team,");
    expect(email.text).not.toContain("A NOTE FROM THE EVERAFT TEAM");
    expect(email.html).not.toContain("A note from the EverAft team");
  });
});
