import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { PLANNING_INVITE_COOKIE } from "@/lib/planning-workspace/invite";
import { GET } from "./route";

const token = "a".repeat(43);

describe("planning invitation redemption", () => {
  it("moves a valid token into a short-lived HttpOnly cookie and redirects to a clean URL", () => {
    const response = GET(new NextRequest(
      `https://www.everaft.co.uk/planning-hub/join/redeem?token=${token}`
    ));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://www.everaft.co.uk/planning-hub/join");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${PLANNING_INVITE_COOKIE}=${token}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/planning-hub/join");
    expect(response.headers.get("location")).not.toContain(token);
  });

  it("rejects malformed tokens without reflecting them into the clean destination", () => {
    const malformedToken = "not-a-valid-token";
    const response = GET(new NextRequest(
      `https://www.everaft.co.uk/planning-hub/join/redeem?token=${malformedToken}`
    ));
    const location = response.headers.get("location") ?? "";

    expect(response.status).toBe(303);
    expect(location).toContain("/planning-hub/join?message=");
    expect(location).not.toContain(malformedToken);
    const clearedCookie = response.cookies.get(PLANNING_INVITE_COOKIE);
    expect(clearedCookie?.value).toBe("");
    expect(clearedCookie?.path).toBe("/planning-hub/join");
  });
});
