import { describe, expect, it, vi } from "vitest";
import {
  emailDomainMatchesOfficialWebsite,
  extractEmails,
  extractJsonLdPublishedPrices,
  extractPublishedPrices,
  isEmailSyntaxValid,
  isPrivateOrReservedIp,
  isPromotablePublicBusinessEmail,
  normalizeCachedEmailFinding,
  normalizePublishedPriceEvidence,
  researchOfficialWebsite,
  robotsAllows,
  type WebsiteEmailFinding
} from "./research";

const publicLookup = (async () => [{ address: "93.184.216.34", family: 4 }]) as never;

function minimalPdf(text: string) {
  const escaped = text.replace(/([\\()])/g, "\\$1");
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escaped}) Tj\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
  ];
  let output = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(output, "ascii"));
    output += object;
  }
  const xrefOffset = Buffer.byteLength(output, "ascii");
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  output += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const buffer = Buffer.from(output, "ascii");
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

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
    expect(prices[0]).toMatchObject({
      amount: 3500,
      currency: "GBP",
      basis: "wedding_package",
      unit: "total",
      qualifier: "from",
      confidence: "high",
      extractionMethod: "visible_text",
      sourceUrl: "https://venue.test/weddings"
    });
    expect(prices[0].evidenceText).toContain("wedding packages start from \u00a33,500");
  });

  it("keeps the price basis separate from per-person units", () => {
    const prices = extractPublishedPrices("Our wedding package starts from \u00a395 per person, including the wedding breakfast.", "https://venue.test/weddings");
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({ amount: 95, basis: "wedding_package", unit: "per_person", qualifier: "from", confidence: "high" });
  });

  it("retains genuine wedding accommodation and catering with explicit units", () => {
    const accommodation = extractPublishedPrices("Wedding guests can stay in our bedrooms from \u00a3160 per room per night.", "https://venue.test/weddings/accommodation");
    const catering = extractPublishedPrices("Wedding catering prices start from \u00a375 per person.", "https://venue.test/weddings/catering");
    expect(accommodation).toHaveLength(1);
    expect(accommodation[0]).toMatchObject({ amount: 160, basis: "accommodation", unit: "per_room" });
    expect(catering).toHaveLength(1);
    expect(catering[0]).toMatchObject({ amount: 75, basis: "catering", unit: "per_person" });
  });

  it("does not mistake guest counts for prices", () => {
    expect(extractPublishedPrices("Wedding venue for receptions from 120 guests.", "https://venue.test/weddings")).toEqual([]);
    expect(extractPublishedPrices("Wedding packages from 120 guests.", "https://venue.test/weddings")).toEqual([]);
  });

  it("does not promote deposits or discounts to starting prices", () => {
    expect(extractPublishedPrices("Wedding booking fee: \u00a3500 deposit; full package pricing is on request.", "https://venue.test/weddings")).toEqual([]);
    expect(extractPublishedPrices("Save \u00a3500 on our wedding package this month.", "https://venue.test/weddings")).toEqual([]);
  });

  it("rejects unrelated accommodation, hospitality, events, and card holds even on a venue site", () => {
    expect(extractPublishedPrices("Our hotel rooms start from \u00a3160 per room per night. We also host weddings.", "https://venue.test/stay")).toEqual([]);
    expect(extractPublishedPrices("Wedding venue guests can enjoy spa packages from \u00a3120 per person.", "https://venue.test/spa")).toEqual([]);
    expect(extractPublishedPrices("Golf event entry fee \u00a350. Weddings are available separately.", "https://venue.test/golf")).toEqual([]);
    expect(extractPublishedPrices("A card pre-authorisation of \u00a350 applies before checking in for your wedding stay.", "https://venue.test/terms")).toEqual([]);
    expect(extractPublishedPrices("Get \u00a31,000 off our wedding package this winter.", "https://venue.test/weddings")).toEqual([]);
  });

  it("extracts classified GBP wedding Offers from JSON-LD and ignores room Offers", () => {
    const html = `
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Winter Wedding Package","offers":{"@type":"Offer","priceCurrency":"GBP","price":"5000","description":"Exclusive use wedding package"}}
      </script>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"LodgingBusiness","name":"Venue Hotel","offers":{"@type":"Offer","name":"Bed and breakfast room","priceCurrency":"GBP","price":"150","unitText":"per night"}}
      </script>`;
    const prices = extractJsonLdPublishedPrices(html, "https://venue.test/weddings");
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({ amount: 5000, basis: "exclusive_use", unit: "total", extractionMethod: "json_ld_offer" });
    expect(prices[0].evidenceText).toContain('"price":"5000"');
  });

  it("reclassifies legacy checkpoint prices and drops unsafe legacy findings", () => {
    expect(normalizePublishedPriceEvidence({
      amount: 7150,
      currency: "GBP",
      context: "Exclusive use wedding venue hire starts from \u00a37,150.",
      sourceUrl: "https://venue.test/weddings"
    })).toMatchObject({ basis: "exclusive_use", unit: "total", extractionMethod: "legacy_checkpoint" });
    expect(normalizePublishedPriceEvidence({
      amount: 1000,
      currency: "GBP",
      context: "Save \u00a31,000 off a wedding package.",
      sourceUrl: "https://venue.test/weddings"
    })).toBeNull();
  });

  it("uses an advertised sitemap to discover a wedding pricing page", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("robots.txt")) {
        return new Response("User-agent: *\nAllow: /\nSitemap: https://venue.test/site-map.xml\n", { headers: { "content-type": "text/plain" } });
      }
      if (href.endsWith("site-map.xml")) {
        return new Response("<urlset><url><loc>https://venue.test/about</loc></url><url><loc>https://venue.test/weddings/pricing</loc></url></urlset>", { headers: { "content-type": "application/xml" } });
      }
      if (href.endsWith("sitemap.xml")) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
      if (href.includes("/weddings/pricing")) {
        return new Response("<h1>Wedding packages</h1><p>Exclusive use starts from \u00a36,500 per event.</p>", { headers: { "content-type": "text/html" } });
      }
      return new Response("<h1>Official venue</h1>", { headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;
    const result = await researchOfficialWebsite(
      { id: "venue-1", name: "Venue", officialWebsiteUrl: "https://venue.test/" },
      { fetchImpl, lookupImpl: publicLookup, maxPages: 2, retries: 0, minimumHostDelayMs: 0 }
    );
    expect(result.pagesChecked).toContain("https://venue.test/weddings/pricing");
    expect(result.publishedPrices).toHaveLength(1);
    expect(result.publishedPrices[0]).toMatchObject({ amount: 6500, basis: "exclusive_use", unit: "per_event" });
  });

  it("does not mark an active venue closed because a former on-site operation ceased trading", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
      if (href.endsWith("sitemap.xml")) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
      return new Response("<h1>Wedding bookings</h1><p>The golf club ceased trading in 2016. Enquire now about our wedding venue and availability.</p>", { headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;
    const result = await researchOfficialWebsite(
      { id: "venue-history", name: "Active Venue", officialWebsiteUrl: "https://venue.test/" },
      { fetchImpl, lookupImpl: publicLookup, maxPages: 1, retries: 0, minimumHostDelayMs: 0 }
    );
    expect(result.businessStatus).toBe("likely_active");
  });

  it("still recognises an explicit first-person closure notice", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
      if (href.endsWith("sitemap.xml")) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
      return new Response("<h1>Closure notice</h1><p>We have ceased trading and are no longer accepting wedding bookings.</p>", { headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;
    const result = await researchOfficialWebsite(
      { id: "venue-closed", name: "Closed Venue", officialWebsiteUrl: "https://venue.test/" },
      { fetchImpl, lookupImpl: publicLookup, maxPages: 1, retries: 0, minimumHostDelayMs: 0 }
    );
    expect(result.businessStatus).toBe("closed");
  });

  it("extracts classified prices from a directly linked official PDF brochure", async () => {
    const pdf = minimalPdf("Wedding package starts from GBP 6,250 per event.");
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
      if (href.endsWith("sitemap.xml")) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
      if (href.endsWith("wedding-prices.pdf")) {
        return new Response(pdf, { headers: { "content-type": "application/pdf", "content-length": String(pdf.byteLength) } });
      }
      return new Response('<a href="/brochures/wedding-prices.pdf">Download wedding pricing PDF</a>', { headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;
    const result = await researchOfficialWebsite(
      { id: "venue-pdf", name: "PDF Venue", officialWebsiteUrl: "https://venue.test/" },
      { fetchImpl, lookupImpl: publicLookup, maxPages: 1, retries: 0, minimumHostDelayMs: 0 }
    );
    expect(result.publishedPrices).toHaveLength(1);
    expect(result.publishedPrices[0]).toMatchObject({
      amount: 6250,
      basis: "wedding_package",
      unit: "per_event",
      extractionMethod: "pdf_text",
      sourceUrl: "https://venue.test/brochures/wedding-prices.pdf"
    });
    expect(result.publishedPrices[0].evidenceText).toContain("GBP 6,250");
    expect(result.evidence).toContainEqual(expect.objectContaining({
      sourceUrl: "https://venue.test/brochures/wedding-prices.pdf",
      sourceType: "official_pricing_pdf"
    }));
  });

  it("skips external PDF links and does not follow an official PDF redirect off-site", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("external.test")) throw new Error("External PDF must never be requested.");
      if (href.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
      if (href.endsWith("sitemap.xml")) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
      if (href.endsWith("official-brochure.pdf")) return new Response(null, { status: 302, headers: { location: "https://external.test/brochure.pdf" } });
      return new Response('<a href="https://external.test/prices.pdf">External wedding PDF</a><a href="/official-brochure.pdf">Official wedding brochure PDF</a>', { headers: { "content-type": "text/html" } });
    });
    const fetchImpl = fetchMock as unknown as typeof fetch;
    const result = await researchOfficialWebsite(
      { id: "venue-pdf", name: "PDF Venue", officialWebsiteUrl: "https://venue.test/" },
      { fetchImpl, lookupImpl: publicLookup, maxPages: 1, retries: 0, minimumHostDelayMs: 0 }
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("external.test"))).toBe(false);
    expect(result.publishedPrices).toEqual([]);
    expect(result.warnings).toContainEqual(expect.stringMatching(/PDF redirect left the official website host/i));
  });

  it("rejects an official PDF whose declared size exceeds the byte limit", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
      if (href.endsWith("sitemap.xml")) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
      if (href.endsWith("large-wedding-brochure.pdf")) {
        return new Response("%PDF-1.4", { headers: { "content-type": "application/pdf", "content-length": "5000001" } });
      }
      return new Response('<a href="/large-wedding-brochure.pdf">Wedding pricing brochure PDF</a>', { headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;
    const result = await researchOfficialWebsite(
      { id: "venue-pdf", name: "PDF Venue", officialWebsiteUrl: "https://venue.test/" },
      { fetchImpl, lookupImpl: publicLookup, maxPages: 1, retries: 0, minimumHostDelayMs: 0 }
    );
    expect(result.publishedPrices).toEqual([]);
    expect(result.warnings).toContainEqual(expect.stringMatching(/5000000 byte research limit/i));
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
