import { describe, expect, it, vi } from "vitest";
import {
  emailDomainMatchesOfficialWebsite,
  extractEmails,
  extractPublishedPrices,
  isEmailSyntaxValid,
  isPrivateOrReservedIp,
  isPromotablePublicBusinessEmail,
  normalizeCachedEmailFinding,
  researchOfficialWebsite,
  robotsAllows,
  type WebsiteEmailFinding
} from "./research";

const publicLookup = (async () => [{ address: "93.184.216.34", family: 4 }]) as never;

describe("enrichment website research", () => {
  it("honours robots.txt allow and disallow rules using the longest match", () => {
    const robots = "User-agent: *\nDisallow: /private\nAllow: /private/public\n";
    expect(robotsAllows(robots, "https://venue.example/private", "EverAftDataQualityAudit")).toBe(false);
    expect(robotsAllows(robots, "https://venue.example/private/public", "EverAftDataQualityAudit")).toBe(true);
  });

  it("uses the most specific robots user-agent group and supports wildcard/end-anchor rules", () => {
    const robots = "User-agent: *\nDisallow: /\n\nUser-agent: EverAftDataQualityAudit\nAllow: /public/*\nDisallow: /public/private$\n";
    expect(robotsAllows(robots, "https://venue.example/public/weddings", "EverAftDataQualityAudit")).toBe(true);
    expect(robotsAllows(robots, "https://venue.example/public/private", "EverAftDataQualityAudit")).toBe(false);
  });

  it("extracts visible and mailto emails but rejects placeholders and image filenames", () => {
    const emails = extractEmails('<a href="mailto:weddings@venue.co.uk">Email us</a> info@example.com hero@2x.png');
    expect(emails).toEqual(["weddings@venue.co.uk"]);
    expect(isEmailSyntaxValid("hello@venue.co.uk")).toBe(true);
    expect(isEmailSyntaxValid("not-an-email")).toBe(false);
    expect(isEmailSyntaxValid("//outlook.office365.com/owa/calendar/book@venue.co.uk")).toBe(false);
    expect(isEmailSyntaxValid("%20info@venue.co.uk")).toBe(false);
  });

  it("does not treat script-only addresses as publicly published business contacts", () => {
    const emails = extractEmails('<script>window.support = "agency@third-party.test"</script><p>Email weddings@venue.test</p>');
    expect(emails).toEqual(["weddings@venue.test"]);
  });

  it("only associates the exact official domain and its subdomains", () => {
    expect(emailDomainMatchesOfficialWebsite("venue.test", "https://venue.test")).toBe(true);
    expect(emailDomainMatchesOfficialWebsite("mail.venue.test", "https://venue.test")).toBe(true);
    expect(emailDomainMatchesOfficialWebsite("venue.test", "https://weddings.venue.test")).toBe(false);
    expect(emailDomainMatchesOfficialWebsite("third-party.test", "https://venue.test")).toBe(false);
  });

  it("never promotes an MX-valid third-party address found on an official page", () => {
    const finding = {
      email: "sales@third-party.test",
      type: "sales",
      sourceUrl: "https://venue.test/contact",
      confidence: "high",
      verification: {
        email: "sales@third-party.test",
        syntaxValid: true,
        domainExists: true,
        mxValid: true,
        mxHosts: ["mx.third-party.test"],
        disposable: false,
        roleBased: true,
        domainAssociated: false,
        status: "likely_valid",
        method: "test",
        checkedAt: "2026-07-12T00:00:00.000Z",
        notes: []
      }
    } satisfies WebsiteEmailFinding;
    expect(isPromotablePublicBusinessEmail(finding, "https://venue.test")).toBe(false);
  });

  it("normalizes a cached likely-valid third-party finding before it is reported", () => {
    const cached = {
      email: "user@domain.com",
      type: "general",
      sourceUrl: "https://venue.test/contact",
      confidence: "high",
      verification: {
        email: "user@domain.com",
        syntaxValid: true,
        domainExists: true,
        mxValid: true,
        mxHosts: ["mx.domain.com"],
        disposable: false,
        roleBased: false,
        domainAssociated: true,
        status: "likely_valid",
        method: "old_cached_check",
        checkedAt: "2026-07-12T00:00:00.000Z",
        notes: ["The email domain differs from the official website; official-page publication is still required as ownership evidence."]
      }
    } satisfies WebsiteEmailFinding;

    const normalized = normalizeCachedEmailFinding(cached, "https://venue.test");
    expect(normalized.verification).toMatchObject({
      domainAssociated: false,
      status: "unverified",
      method: "syntax+dns_mx+official_domain_association_rechecked"
    });
    expect(normalized.verification.notes).toEqual([
      "The cached email domain is not the current official website domain or one of its subdomains."
    ]);
    expect(isPromotablePublicBusinessEmail(normalized, "https://venue.test")).toBe(false);
  });

  it("records only wedding-related published prices and preserves the evidence context", () => {
    const prices = extractPublishedPrices("Our wedding packages start from \u00a33,500 for exclusive venue hire. Coffee from \u00a34.", "https://venue.test/weddings");
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({ amount: 3500, currency: "GBP", sourceUrl: "https://venue.test/weddings" });
  });

  it("does not mistake guest counts for prices", () => {
    expect(extractPublishedPrices("Wedding venue for receptions from 120 guests.", "https://venue.test/weddings")).toEqual([]);
    expect(extractPublishedPrices("Wedding packages from 120 guests.", "https://venue.test/weddings")).toEqual([]);
  });

  it("does not promote deposits or discounts to starting prices", () => {
    expect(extractPublishedPrices("Wedding booking fee: \u00a3500 deposit; full package pricing is on request.", "https://venue.test/weddings")).toEqual([]);
    expect(extractPublishedPrices("Save \u00a3500 on our wedding package this month.", "https://venue.test/weddings")).toEqual([]);
  });

  it("stops before crawling when robots blocks the official website", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      return new Response(href.endsWith("robots.txt") ? "User-agent: EverAftDataQualityAudit\nDisallow: /\n" : "<p>Should not load</p>", {
        status: 200,
        headers: { "content-type": href.endsWith("robots.txt") ? "text/plain" : "text/html" }
      });
    }) as unknown as typeof fetch;
    const result = await researchOfficialWebsite({ id: "venue-1", name: "Venue", officialWebsiteUrl: "https://venue.test/" }, { fetchImpl, lookupImpl: publicLookup, retries: 0, minimumHostDelayMs: 0 });
    expect(result.status).toBe("robots_blocked");
    expect(result.pagesChecked).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("records an official contact source without sending or mutating anything", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
      return new Response('<a href="mailto:weddings@venue.test">Wedding enquiries</a><p>Contact us for pricing.</p>', {
        headers: { "content-type": "text/html" }
      });
    }) as unknown as typeof fetch;
    const result = await researchOfficialWebsite({ id: "venue-1", name: "Venue", officialWebsiteUrl: "https://venue.test/" }, { fetchImpl, lookupImpl: publicLookup, maxPages: 1, retries: 0, minimumHostDelayMs: 0 });
    expect(result.pagesChecked).toHaveLength(1);
    expect(result.emails[0]).toMatchObject({ email: "weddings@venue.test", sourceUrl: "https://venue.test/", type: "wedding" });
    expect(result.pricingStatus).toBe("contact_for_price");
  });

  it("rejects private, loopback, link-local and metadata-style network targets", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.0.8")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("93.184.216.34")).toBe(false);
  });

  it("does not issue an HTTP request when DNS resolves to a private address", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const privateLookup = (async () => [{ address: "169.254.169.254", family: 4 }]) as never;
    const result = await researchOfficialWebsite(
      { id: "venue-1", name: "Venue", officialWebsiteUrl: "https://venue.test/" },
      { fetchImpl, lookupImpl: privateLookup, retries: 0, minimumHostDelayMs: 0 }
    );
    expect(result.status).toBe("failed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
