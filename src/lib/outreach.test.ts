import { describe, expect, it } from "vitest";
import { summarizeOutreachDelivery } from "./outreach-delivery";

describe("outreach delivery summary", () => {
  it("separates provider acceptance from actual delivery outcomes", () => {
    const summary = summarizeOutreachDelivery([
      { status: "delivered" },
      { status: "delivered" },
      { status: "bounced" },
      { status: "unsubscribed" },
      { status: "failed" },
      { status: "sent" }
    ]);

    expect(summary).toEqual({
      accepted: 6,
      delivered: 2,
      bounced: 1,
      unsubscribed: 1,
      complained: 0,
      failed: 1,
      suppressed: 0,
      pending: 1
    });
  });
});
