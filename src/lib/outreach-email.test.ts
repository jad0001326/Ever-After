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
        supplierCategorySlug: null,
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

  it("routes a category-neutral supplier invitation to its verified claim page", () => {
    const copy = defaultOutreachCopyFor("supplier", "initial_invite");
    const email = buildOutreachEmail({
      copy,
      kind: "initial_invite",
      recipient: {
        audienceType: "supplier",
        supplierCategorySlug: "videographer",
        businessName: "Highland Films",
        town: "Inverness",
        listingSlug: "highland-films",
        unsubscribeUrl: "https://www.everaft.co.uk/outreach/unsubscribe?preview=1",
      },
    });

    expect(email.text).toContain("/suppliers/videographer/highland-films/claim");
    expect(email.text).toContain("Founding suppliers can claim");
    expect(email.html).not.toContain("wedding photographers");
  });

  it("preserves the canonical photographer claim route", () => {
    const email = buildOutreachEmail({
      copy: defaultOutreachCopyFor("supplier", "initial_invite"),
      kind: "initial_invite",
      recipient: {
        audienceType: "supplier",
        supplierCategorySlug: "photographer",
        businessName: "North Light Photo",
        town: "Aberdeen",
        listingSlug: "north-light-photo",
        unsubscribeUrl: "https://www.everaft.co.uk/outreach/unsubscribe?preview=1",
      },
    });

    expect(email.text).toContain("/photographers/north-light-photo/claim");
  });

  it("keeps legacy photographer campaigns valid without a category column", () => {
    const email = buildOutreachEmail({
      copy: defaultOutreachCopyFor("photographer", "initial_invite"),
      kind: "initial_invite",
      recipient: {
        audienceType: "photographer",
        supplierCategorySlug: null,
        businessName: "Old Mill Photography",
        town: "Perth",
        listingSlug: "old-mill-photography",
        unsubscribeUrl: "https://www.everaft.co.uk/outreach/unsubscribe?preview=1",
      },
    });

    expect(email.text).toContain("/photographers/old-mill-photography/claim");
    expect(email.text).toContain("Founding suppliers can claim");
  });

  it("rejects a generic supplier email without a validated category", () => {
    expect(() => buildOutreachEmail({
      copy: defaultOutreachCopyFor("supplier", "initial_invite"),
      kind: "initial_invite",
      recipient: {
        audienceType: "supplier",
        supplierCategorySlug: null,
        businessName: "Unknown Supplier",
        town: "Glasgow",
        listingSlug: "unknown-supplier",
        unsubscribeUrl: "https://www.everaft.co.uk/outreach/unsubscribe?preview=1",
      },
    })).toThrow("Supplier outreach requires a category slug.");
  });
});
