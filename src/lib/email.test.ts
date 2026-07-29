import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidEmailRecipient, notifyClaimReviewed, sendEmailBatch } from "./email";

describe("email delivery validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts plain and named recipients but rejects one-character top-level domains", () => {
    expect(isValidEmailRecipient("hello@venue.co.uk")).toBe(true);
    expect(isValidEmailRecipient("Venue Team <hello@venue.co.uk>")).toBe(true);
    expect(isValidEmailRecipient("info@ayrehotel.co.u")).toBe(false);
  });

  it("keeps an invalid recipient out of the provider batch without blocking valid messages", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_FROM_EMAIL", "EverAft <hello@everaft.co.uk>");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "valid-delivery-id" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await sendEmailBatch([
      { to: "info@ayrehotel.co.u", subject: "Invalid", text: "Invalid" },
      { to: "hello@venue.co.uk", subject: "Valid", text: "Valid" }
    ], "batch-validation-test");

    expect(results).toEqual([
      { ok: false, skipped: false, error: "Invalid recipient email address." },
      { ok: true, skipped: false, id: "valid-delivery-id", error: undefined }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual([
      expect.objectContaining({ to: ["hello@venue.co.uk"], subject: "Valid" })
    ]);
  });

  it("sends the branded welcome to both unique claim addresses after approval", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.everaft.co.uk");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_FROM_EMAIL", "EverAft <hello@everaft.co.uk>");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "welcome-delivery-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await notifyClaimReviewed({
      claimId: "claim-123",
      venueName: "Blackshaw Barns",
      venueSlug: "blackshaw-barns",
      claimantName: "Eilidh Grant",
      claimantEmail: "eilidh@example.com",
      businessEmail: "hello@blackshaw.test",
      status: "approved",
      adminNotes: null
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(body.to).toEqual(["eilidh@example.com", "hello@blackshaw.test"]);
    expect(body.subject).toBe("Welcome to EverAft — Blackshaw Barns is now claimed");
    expect(body.text).toContain("https://www.everaft.co.uk/vendor");
    expect(body.html).toContain("Open your vendor dashboard");
    expect(new Headers(request.headers).get("Idempotency-Key")).toBe("claim-approved-claim-123");
  });

  it("does not send the same claim welcome address twice when email casing differs", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_FROM_EMAIL", "EverAft <hello@everaft.co.uk>");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "welcome-delivery-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await notifyClaimReviewed({
      claimId: "claim-456",
      venueName: "North House",
      venueSlug: "north-house",
      claimantName: "Rowan",
      claimantEmail: "Team@North-House.test",
      businessEmail: "team@north-house.test",
      status: "approved",
      adminNotes: null
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body)).to).toEqual(["Team@North-House.test"]);
  });
});
