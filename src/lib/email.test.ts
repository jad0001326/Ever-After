import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidEmailRecipient, sendEmailBatch } from "./email";

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
});
