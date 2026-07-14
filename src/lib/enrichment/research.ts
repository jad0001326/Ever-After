import { lookup, resolve4, resolve6, resolveMx } from "node:dns/promises";
import { isIP } from "node:net";
import { PDFParse } from "pdf-parse";

export type ResearchConfidence = "high" | "medium" | "low";
export type EmailVerificationStatus =
  | "verified"
  | "likely_valid"
  | "unverified"
  | "invalid"
  | "hard_bounce"
  | "suppressed"
  | "opted_out"
  | "not_found";

export type ResearchTarget = {
  id: string;
  name: string;
  officialWebsiteUrl: string;
  existingEmail?: string | null;
};

export type ResearchOptions = {
  fetchImpl?: typeof fetch;
  lookupImpl?: typeof lookup;
  maxPages?: number;
  timeoutMs?: number;
  retries?: number;
  minimumHostDelayMs?: number;
  userAgent?: string;
  maxPdfDocuments?: number;
  maxPdfBytes?: number;
  pdfTextExtractor?: (data: Uint8Array) => Promise<string>;
};

export type PublishedPriceBasis =
  | "venue_hire"
  | "exclusive_use"
  | "wedding_package"
  | "per_person"
  | "catering"
  | "accommodation"
  | "ceremony_fee"
  | "minimum_spend"
  | "wedding_price";

export type PublishedPrice = {
  amount: number;
  currency: "GBP";
  context: string;
  sourceUrl: string;
  basis: PublishedPriceBasis;
  unit: "total" | "per_person" | "per_night" | "per_room" | "per_event" | "per_hour" | "unspecified";
  qualifier: "from" | "fixed" | "range_low" | "range_high";
  confidence: ResearchConfidence;
  evidenceText: string;
  extractionMethod: "visible_text" | "json_ld_offer" | "pdf_text" | "legacy_checkpoint";
};

export type EmailVerification = {
  email: string;
  syntaxValid: boolean;
  domainExists: boolean | null;
  mxValid: boolean | null;
  mxHosts: string[];
  disposable: boolean;
  roleBased: boolean;
  domainAssociated: boolean;
  status: EmailVerificationStatus;
  method: string;
  checkedAt: string;
  notes: string[];
};

export type WebsiteResearchResult = {
  researchVersion?: number;
  targetId: string;
  businessName: string;
  officialWebsiteUrl: string;
  status: "completed" | "robots_blocked" | "failed";
  checkedAt: string;
  pagesChecked: string[];
  emails: Array<{
    email: string;
    type: "wedding" | "sales" | "bookings" | "owner" | "manager" | "general" | "reception";
    sourceUrl: string;
    confidence: ResearchConfidence;
    verification: EmailVerification;
  }>;
  contactPageUrl: string | null;
  enquiryPageUrl: string | null;
  weddingPageUrl: string | null;
  pricingStatus: "published" | "contact_for_price" | "not_found";
  publishedPrices: PublishedPrice[];
  businessStatus: "active" | "likely_active" | "temporarily_closed" | "closed" | "rebranded" | "uncertain";
  evidence: Array<{ sourceUrl: string; sourceType: string; accessedAt: string; notes: string }>;
  warnings: string[];
  requestCount: number;
  retryCount: number;
};

export type WebsiteEmailFinding = WebsiteResearchResult["emails"][number];

const emailPattern = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi;
const linkPattern = /<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
const roleLocalParts = new Set([
  "admin", "bookings", "contact", "enquiries", "enquiry", "events", "hello", "info", "office", "reception",
  "reservations", "sales", "team", "venue", "wedding", "weddings"
]);
const disposableDomains = new Set([
  "10minutemail.com", "guerrillamail.com", "mailinator.com", "temp-mail.org", "tempmail.com", "yopmail.com"
]);
const ignoredEmailFragments = ["example.", "sentry", "wixpress", "wordpress", "cloudflare", "noreply", "no-reply"];
const preferredLinkTerms = [
  "wedding", "pricing", "prices", "packages", "venue-hire", "exclusive-use", "brochure", "contact", "enquir", "events", "book", "faq",
  "terms", "privacy"
];
export const WEBSITE_RESEARCH_VERSION = 3;

const hostLastRequestAt = new Map<string, number>();

export async function researchOfficialWebsite(target: ResearchTarget, options: ResearchOptions = {}): Promise<WebsiteResearchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookupImpl = options.lookupImpl ?? lookup;
  const maxPages = clamp(options.maxPages ?? 5, 1, 10);
  const timeoutMs = clamp(options.timeoutMs ?? 10_000, 1_000, 30_000);
  const retries = clamp(options.retries ?? 2, 0, 4);
  const minimumHostDelayMs = clamp(options.minimumHostDelayMs ?? 750, 0, 10_000);
  const userAgent = options.userAgent ?? "EverAftDataQualityAudit/1.0 (+https://www.everaft.co.uk)";
  const maxPdfDocuments = clamp(options.maxPdfDocuments ?? 3, 0, 5);
  const maxPdfBytes = clamp(options.maxPdfBytes ?? 5_000_000, 100_000, 10_000_000);
  const pdfTextExtractor = options.pdfTextExtractor ?? extractPdfText;
  const checkedAt = new Date().toISOString();
  const result: WebsiteResearchResult = {
    researchVersion: WEBSITE_RESEARCH_VERSION,
    targetId: target.id,
    businessName: target.name,
    officialWebsiteUrl: target.officialWebsiteUrl,
    status: "completed",
    checkedAt,
    pagesChecked: [],
    emails: [],
    contactPageUrl: null,
    enquiryPageUrl: null,
    weddingPageUrl: null,
    pricingStatus: "not_found",
    publishedPrices: [],
    businessStatus: "uncertain",
    evidence: [],
    warnings: [],
    requestCount: 0,
    retryCount: 0
  };

  const website = publicHttpUrl(target.officialWebsiteUrl);
  if (!website) {
    result.status = "failed";
    result.warnings.push("Official website URL is missing or invalid.");
    return result;
  }

  const robotsUrl = new URL("/robots.txt", website).toString();
  let robotsText = "";
  try {
    const robots = await fetchWithPolicy(robotsUrl, { fetchImpl, lookupImpl, timeoutMs, retries, minimumHostDelayMs, userAgent });
    result.requestCount += robots.requestCount;
    result.retryCount += robots.retryCount;
    if (robots.response.ok) robotsText = robots.body;
  } catch (error) {
    result.warnings.push(`robots.txt could not be checked: ${errorMessage(error)}`);
  }
  if (robotsText && !robotsAllows(robotsText, website, "EverAftDataQualityAudit")) {
    result.status = "robots_blocked";
    result.warnings.push("robots.txt disallows the official website root for this audit user agent.");
    return result;
  }

  const sitemapDiscovery = await discoverSitemapPageUrls(website, robotsText, maxPages * 2, {
    fetchImpl, lookupImpl, timeoutMs, retries, minimumHostDelayMs, userAgent
  });
  result.requestCount += sitemapDiscovery.requestCount;
  result.retryCount += sitemapDiscovery.retryCount;
  result.warnings.push(...sitemapDiscovery.warnings);
  const queue = [website, ...sitemapDiscovery.urls];
  const queued = new Set(queue.map(normalizedUrlKey));
  const emailEvidence = new Map<string, { email: string; sourceUrl: string }>();
  const priceEvidence = new Map<string, PublishedPrice>();
  const pdfLinks = new Map<string, { url: string; text: string }>();
  let sawCurrentTradingEvidence = false;

  while (queue.length && result.pagesChecked.length < maxPages) {
    const requestedUrl = queue.shift()!;
    if (robotsText && !robotsAllows(robotsText, requestedUrl, "EverAftDataQualityAudit")) {
      result.warnings.push(`Skipped a robots-disallowed page: ${requestedUrl}`);
      continue;
    }
    try {
      const page = await fetchWithPolicy(requestedUrl, { fetchImpl, lookupImpl, timeoutMs, retries, minimumHostDelayMs, userAgent });
      result.requestCount += page.requestCount;
      result.retryCount += page.retryCount;
      if (!page.response.ok) {
        result.warnings.push(`${requestedUrl} returned HTTP ${page.response.status}.`);
        continue;
      }
      const contentType = page.response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) continue;
      const resolvedUrl = page.response.url || requestedUrl;
      if (!sameOfficialHost(resolvedUrl, website)) {
        result.warnings.push(`Skipped off-site redirect: ${resolvedUrl}`);
        continue;
      }
      result.pagesChecked.push(resolvedUrl);
      const visibleText = htmlToText(page.body);
      const lowerText = visibleText.toLowerCase();
      if (/book(?:ing)?|enquir|wedding|events?|availability|packages?/.test(lowerText)) sawCurrentTradingEvidence = true;
      updateBusinessStatus(result, lowerText);

      for (const email of extractEmails(page.body)) {
        if (!emailEvidence.has(email)) emailEvidence.set(email, { email, sourceUrl: resolvedUrl });
      }
      for (const price of [...extractPublishedPrices(visibleText, resolvedUrl), ...extractJsonLdPublishedPrices(page.body, resolvedUrl)]) {
        const key = publishedPriceKey(price);
        const existing = priceEvidence.get(key);
        if (!existing || (existing.extractionMethod === "json_ld_offer" && price.extractionMethod === "visible_text")) {
          priceEvidence.set(key, price);
        }
      }
      for (const link of extractOfficialPdfLinks(page.body, resolvedUrl, website)) {
        const key = normalizedUrlKey(link.url);
        if (!pdfLinks.has(key) && pdfLinks.size < maxPdfDocuments * 4) pdfLinks.set(key, link);
      }
      if (/contact\s+(?:us|for)|get\s+in\s+touch/.test(lowerText) && !result.contactPageUrl) result.contactPageUrl = resolvedUrl;
      if (/enquir|request\s+(?:a\s+)?brochure|check\s+availability/.test(lowerText) && !result.enquiryPageUrl) result.enquiryPageUrl = resolvedUrl;
      if (/wedding|ceremony|reception/.test(lowerText) && !result.weddingPageUrl) result.weddingPageUrl = resolvedUrl;
      if (/contact\s+(?:us\s+)?for\s+(?:pricing|prices|a\s+quote)|price\s+on\s+(?:application|request)|request\s+(?:a\s+)?(?:quote|brochure)|bespoke\s+quote/i.test(visibleText)) {
        result.pricingStatus = "contact_for_price";
        result.evidence.push({ sourceUrl: resolvedUrl, sourceType: "official_pricing", accessedAt: checkedAt, notes: "Official page directs visitors to enquire for pricing." });
      }

      const links = extractSameHostLinks(page.body, resolvedUrl, website);
      links.sort((left, right) => scoreLink(right) - scoreLink(left));
      for (const link of links) {
        const key = normalizedUrlKey(link.url);
        if (queued.has(key) || queue.length + result.pagesChecked.length >= maxPages * 3) continue;
        queued.add(key);
        queue.push(link.url);
      }
    } catch (error) {
      result.warnings.push(`${requestedUrl} could not be read: ${errorMessage(error)}`);
    }
  }

  const selectedPdfLinks = [...pdfLinks.values()]
    .sort((left, right) => scoreLink(right) - scoreLink(left) || left.url.localeCompare(right.url))
    .slice(0, maxPdfDocuments);
  for (const link of selectedPdfLinks) {
    if (robotsText && !robotsAllows(robotsText, link.url, "EverAftDataQualityAudit")) {
      result.warnings.push(`Skipped a robots-disallowed PDF: ${link.url}`);
      continue;
    }
    try {
      const pdf = await fetchPdfWithPolicy(link.url, website, maxPdfBytes, {
        fetchImpl, lookupImpl, timeoutMs, retries, minimumHostDelayMs, userAgent
      });
      result.requestCount += pdf.requestCount;
      result.retryCount += pdf.retryCount;
      if (!pdf.response.ok) {
        result.warnings.push(`${link.url} returned HTTP ${pdf.response.status}.`);
        continue;
      }
      if (!hasPdfMagicBytes(pdf.data)) {
        result.warnings.push(`Skipped a linked document without a valid PDF header: ${pdf.resolvedUrl}`);
        continue;
      }
      const pdfText = (await pdfTextExtractor(pdf.data)).slice(0, 1_000_000);
      const pdfPrices = extractPublishedPrices(pdfText, pdf.resolvedUrl).map((price): PublishedPrice => ({
        ...price,
        extractionMethod: "pdf_text"
      }));
      for (const price of pdfPrices) {
        const key = publishedPriceKey(price);
        if (!priceEvidence.has(key)) priceEvidence.set(key, price);
      }
      result.evidence.push({
        sourceUrl: pdf.resolvedUrl,
        sourceType: "official_pricing_pdf",
        accessedAt: checkedAt,
        notes: pdfPrices.length
          ? `Official PDF brochure yielded ${pdfPrices.length} classified pricing item${pdfPrices.length === 1 ? "" : "s"}.`
          : "Official PDF brochure was checked but yielded no safely classified pricing."
      });
    } catch (error) {
      result.warnings.push(`${link.url} PDF could not be read: ${errorMessage(error)}`);
    }
  }

  result.publishedPrices = [...priceEvidence.values()].sort((left, right) => left.amount - right.amount).slice(0, 20);
  if (result.publishedPrices.length) result.pricingStatus = "published";
  if (result.businessStatus === "uncertain" && sawCurrentTradingEvidence) result.businessStatus = "likely_active";
  if (result.pagesChecked.length === 0) {
    result.status = "failed";
    result.businessStatus = "uncertain";
  }

  for (const { email, sourceUrl } of emailEvidence.values()) {
    const verification = await verifyPublicEmail(email, website);
    const confidence: ResearchConfidence = verification.status === "likely_valid" && sameOfficialHost(sourceUrl, website) ? "high" : "medium";
    result.emails.push({ email, type: classifyEmail(email), sourceUrl, confidence, verification });
  }
  result.emails.sort(compareEmailFindings);
  return result;
}

export async function verifyPublicEmail(emailValue: string, officialWebsiteUrl: string): Promise<EmailVerification> {
  const email = emailValue.trim().toLowerCase();
  const syntaxValid = isEmailSyntaxValid(email);
  const checkedAt = new Date().toISOString();
  const domain = syntaxValid ? email.split("@")[1] : "";
  const localPart = syntaxValid ? email.split("@")[0] : "";
  const disposable = disposableDomains.has(domain);
  const roleBased = roleLocalParts.has(localPart);
  const domainAssociated = Boolean(domain && emailDomainMatchesOfficialWebsite(domain, officialWebsiteUrl));
  const notes: string[] = [];
  let domainExists: boolean | null = null;
  let mxValid: boolean | null = null;
  let mxHosts: string[] = [];

  if (!syntaxValid) {
    return { email, syntaxValid, domainExists: false, mxValid: false, mxHosts, disposable, roleBased, domainAssociated, status: "invalid", method: "syntax", checkedAt, notes: ["Email syntax is invalid."] };
  }
  try {
    const records = await withTimeout(resolveMx(domain), 8_000);
    mxHosts = records.filter((record) => record.exchange && record.exchange !== ".").sort((a, b) => a.priority - b.priority).map((record) => record.exchange);
    mxValid = mxHosts.length > 0;
    domainExists = true;
  } catch (error) {
    const code = dnsErrorCode(error);
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "ENODOMAIN") {
      mxValid = false;
      try {
        const [v4, v6] = await Promise.allSettled([withTimeout(resolve4(domain), 5_000), withTimeout(resolve6(domain), 5_000)]);
        domainExists = (v4.status === "fulfilled" && v4.value.length > 0) || (v6.status === "fulfilled" && v6.value.length > 0);
      } catch {
        domainExists = false;
      }
    } else {
      notes.push(`MX lookup was inconclusive: ${errorMessage(error)}`);
    }
  }

  if (disposable) notes.push("The address uses a known disposable email domain.");
  if (roleBased) notes.push("The address is role-based, which is acceptable only when publicly provided for business enquiries.");
  if (!domainAssociated) notes.push("The email domain is not the official website domain or one of its subdomains, so it cannot be promoted as a venue contact.");
  let status: EmailVerificationStatus = "unverified";
  if (!domainExists || disposable) status = "invalid";
  else if (mxValid && domainAssociated) status = "likely_valid";
  return {
    email, syntaxValid, domainExists, mxValid, mxHosts, disposable, roleBased, domainAssociated, status,
    method: "syntax+dns_mx+official_domain_association", checkedAt, notes
  };
}

export function robotsAllows(robotsText: string, targetUrl: string, userAgent: string) {
  const url = publicHttpUrl(targetUrl);
  if (!url) return false;
  const path = `${new URL(url).pathname}${new URL(url).search}` || "/";
  const groups = parseRobotsGroups(robotsText);
  const normalizedAgent = userAgent.toLowerCase();
  const scoredGroups = groups.map((group) => ({
    group,
    specificity: Math.max(...group.agents.map((agent) => agent === "*" ? 0 : normalizedAgent.includes(agent) ? agent.length : -1))
  })).filter((item) => item.specificity >= 0);
  if (!scoredGroups.length) return true;
  const bestSpecificity = Math.max(...scoredGroups.map((item) => item.specificity));
  const rules = scoredGroups.filter((item) => item.specificity === bestSpecificity).flatMap((item) => item.group.rules);
  const candidates = rules.filter((rule) => rule.path && robotsPathMatches(rule.path, path));
  if (!candidates.length) return true;
  candidates.sort((left, right) => robotsRuleSpecificity(right.path) - robotsRuleSpecificity(left.path) || Number(right.allow) - Number(left.allow));
  return candidates[0].allow;
}

export function extractPublishedPrices(text: string, sourceUrl: string): PublishedPrice[] {
  const compact = text.replace(/\s+/g, " ");
  const amountPattern = "((?:[1-9]\\d{0,2}(?:,\\d{3})+|[1-9]\\d{1,5})(?:\\.\\d{2})?)";
  const patterns = [
    new RegExp(`(?:\\u00a3|GBP\\s*)\\s*${amountPattern}`, "gi"),
    new RegExp(`(?:wedding(?:s|\\s+packages?)?|packages?|venue\\s+hire|hire\\s+fee|exclusive\\s+use|ceremony\\s+fee|minimum\\s+spend)\\s+(?:prices?\\s+)?(?:start(?:ing)?\\s+)?(?:from|at|of|is|:)\\s*${amountPattern}`, "gi")
  ];
  const findings = new Map<string, PublishedPrice>();
  for (const pattern of patterns) {
    for (const match of compact.matchAll(pattern)) {
      const rawAmount = match[1];
      const amount = Number(rawAmount.replaceAll(",", ""));
      if (!Number.isFinite(amount) || amount < 20 || amount > 500_000) continue;
      const matchIndex = match.index ?? 0;
      const start = Math.max(0, matchIndex - 220);
      const end = Math.min(compact.length, matchIndex + match[0].length + 220);
      const evidenceText = compact.slice(start, end).trim();
      const normalized = normalizePublishedPriceEvidence({
        amount,
        currency: "GBP",
        context: evidenceText,
        sourceUrl,
        evidenceText,
        extractionMethod: "visible_text"
      });
      if (!normalized) continue;
      const key = publishedPriceKey(normalized);
      if (!findings.has(key)) findings.set(key, normalized);
    }
  }
  return [...findings.values()];
}

export function extractJsonLdPublishedPrices(html: string, sourceUrl: string): PublishedPrice[] {
  const findings = new Map<string, PublishedPrice>();
  const scripts = html.matchAll(/<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    const raw = script[1].trim().replace(/^<!--|-->$/g, "").trim();
    if (!raw) continue;
    try {
      visitJsonLd(JSON.parse(raw), "", false, (candidate) => {
        const normalized = normalizePublishedPriceEvidence({
          ...candidate,
          currency: "GBP",
          sourceUrl,
          extractionMethod: "json_ld_offer"
        });
        if (!normalized) return;
        const key = publishedPriceKey(normalized);
        if (!findings.has(key)) findings.set(key, normalized);
      });
    } catch {
      // Invalid JSON-LD is common and must not make the official-site crawl fail.
    }
  }
  return [...findings.values()];
}

export async function extractPdfText(data: Uint8Array) {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText({ first: 80 });
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export function normalizePublishedPriceEvidence(price: {
  amount: number;
  currency?: string;
  context: string;
  sourceUrl: string;
  basis?: PublishedPriceBasis;
  unit?: PublishedPrice["unit"];
  qualifier?: PublishedPrice["qualifier"];
  confidence?: ResearchConfidence;
  evidenceText?: string;
  extractionMethod?: PublishedPrice["extractionMethod"];
}): PublishedPrice | null {
  const amount = Number(price.amount);
  if (!Number.isFinite(amount) || amount < 20 || amount > 500_000) return null;
  if (price.currency && !/^(?:GBP|\u00a3)$/i.test(price.currency.trim())) return null;
  const evidenceText = (price.evidenceText ?? price.context).replace(/\s+/g, " ").trim().slice(0, 800);
  const context = price.context.replace(/\s+/g, " ").trim().slice(0, 800);
  const classified = classifyPublishedPriceContext(context, amount);
  if (!classified) return null;
  const confidence = leastConfidence(classified.confidence, price.confidence ?? classified.confidence);
  return {
    amount,
    currency: "GBP",
    context,
    sourceUrl: price.sourceUrl,
    basis: classified.basis,
    unit: classified.unit,
    qualifier: price.qualifier ?? inferPriceQualifier(context, amount),
    confidence,
    evidenceText,
    extractionMethod: price.extractionMethod ?? "legacy_checkpoint"
  };
}

function classifyPublishedPriceContext(context: string, amount: number): Pick<PublishedPrice, "basis" | "unit" | "confidence"> | null {
  const local = contextAroundAmount(context, amount, 150).toLowerCase();
  const amountIndex = findAmountIndex(local, amount);
  const precedingAmount = amountIndex >= 0 ? local.slice(Math.max(0, amountIndex - 120), amountIndex) : local;
  const followingAmount = amountIndex >= 0
    ? local.slice(amountIndex).replace(/^[\d,.]+/, "").slice(0, 45)
    : "";
  const labelBeforeAmount = precedingAmount.replace(/(?:\u00a3|GBP)\s*$/i, "").trim();
  if (/^\s*(?:(?:day|evening)\b.{0,30})?(?:guests?|people|persons?|attendees|delegates|rooms?)\b/.test(followingAmount)) return null;
  const explicitWedding = /\bweddings?\b|\bceremon(?:y|ies)\b|\breceptions?\b|\bbridal\b|\bmarriage\b/.test(local);
  const directWeddingPackage = /\b(?:wedding|reception)\s+(?:day\s+)?packages?\b.{0,55}\b(?:prices?|pricing|costs?|from|start(?:s|ing)?|at|is|of|:)\s*$/.test(labelBeforeAmount) ||
    /^\s*(?:for\s+)?(?:a\s+)?(?:wedding|reception)\s+(?:day\s+)?packages?\b/.test(followingAmount);
  const directNamedPackageLabel = /\b(?:[a-z][\w'-]*\s+){0,3}packages?\b.{0,45}\b(?:prices?|pricing|costs?|from|start(?:s|ing)?|at|is|of|:)\s*$/.test(labelBeforeAmount);
  const directVenueHire = /\b(?:venue|wedding|ceremony|reception)\s+(?:room\s+)?hire\b.{0,55}\b(?:prices?|pricing|costs?|from|start(?:s|ing)?|at|is|of|:)\s*$|\b(?:hire\s+fee|dry\s+hire)\b.{0,55}\b(?:from|start(?:s|ing)?|at|is|of|:)\s*$/.test(labelBeforeAmount) ||
    /^\s*(?:for\s+)?(?:(?:midweek|weekend|weekday|single[-\s]+day|winter|summer|peak|off[-\s]+peak)\s+)?(?:exclusive\s+)?(?:venue|wedding|ceremony|reception)\s+(?:room\s+)?hire\b/.test(followingAmount);
  const directExclusiveUse = /\b(?:exclusive(?:ly)?[-\s]+use|exclusive\s+hire)\b.{0,55}\b(?:prices?|pricing|costs?|from|start(?:s|ing)?|at|is|of|:)\s*$/.test(labelBeforeAmount) ||
    /^\s*(?:for\s+)?(?:exclusive(?:ly)?[-\s]+use|exclusive\s+hire)\b/.test(followingAmount);
  const directNamedPackage = directNamedPackageLabel && (explicitWedding || directVenueHire || directExclusiveUse);
  const strongWeddingTotal = directWeddingPackage || directVenueHire || directExclusiveUse;
  const unit: PublishedPrice["unit"] = /\bper\s+(?:person|head|guest)\b|(?:\u00a3|GBP\s*)?\s*[\d,.]+\s*(?:pp|p\/p)\b/.test(local)
    ? "per_person"
    : /\bper\s+(?:room|bedroom)\b/.test(local)
      ? "per_room"
      : /\bper\s+night\b/.test(local)
        ? "per_night"
        : /\bper\s+(?:event|wedding)\b/.test(local)
          ? "per_event"
          : /\bper\s+hour\b/.test(local)
            ? "per_hour"
            : "unspecified";

  if (/\b(?:deposit|booking\s+fee|holding\s+fee|reservation\s+fee|damage\s+deposit|pre[-\s]?authori[sz]ation)\b/.test(local)) return null;
  if (/\b(?:save|saving|discount|voucher|gift\s+card|cashback|money\s+off|special\s+offer)\b|\b\d+(?:\.\d+)?%\s+off\b|\b(?:GBP|\u00a3)?\s*[\d,]+(?:\.\d+)?\s+off\b/.test(local)) return null;
  if (/\b(?:average\s+wedding\s+cost|wedding\s+budget\s+guide|cost\s+estimator|example\s+cost\s+breakdown|planning\s+guide)\b/.test(local)) return null;

  const accommodationPrice = /\bper\s+(?:room|night|stay)\b|\bovernight\s+stay\b|\b(?:rooms?|bed\s*(?:and|&)\s*breakfast|accommodation|bedrooms?|suite|cottage|lodge|holiday)\s+(?:rates?|prices?|packages?|from)\b/.test(local);
  const directAccommodationPrice = /\b(?:rooms?|bed\s*(?:and|&)\s*breakfast|accommodation|bedrooms?|suite|cottage|lodge|overnight\s+stay)\b.{0,65}\b(?:rates?|prices?|costs?|from|start(?:s|ing)?|at|:)\s*$/.test(labelBeforeAmount) ||
    /^\s*(?:per\s+(?:person|room|night|stay)|for\s+(?:an?\s+)?overnight\s+stay)\b/.test(followingAmount);
  const weddingAccommodation = /\bwedding\s+accommodation\b|\baccommodation\s+for\s+(?:your\s+)?wedding\b|\bwedding\s+guests?\b.{0,55}\b(?:rooms?|stay|accommodation)\b|\b(?:rooms?|stay|accommodation)\b.{0,55}\bfor\s+wedding\s+guests?\b|\b(?:weddings?|bridal)\b.{0,70}\bovernight\s+stay\b|\bovernight\s+stay\b.{0,70}\b(?:weddings?|bridal)\b|\bbridal\s+suite\b/.test(local);
  if (accommodationPrice && directAccommodationPrice && !directNamedPackage) {
    if (weddingAccommodation) return { basis: "accommodation", unit, confidence: "high" };
    return null;
  }
  const totalForGuestCount = /^\s*(?:for|covering)\s+\d{1,3}\s+(?:(?:day(?:\s*time)?|evening)\s+)?guests?\b/.test(followingAmount);
  if (totalForGuestCount && explicitWedding) return { basis: "wedding_package", unit: "per_event", confidence: "high" };
  const cateringPrice = /\b(?:wedding\s+)?(?:catering|menus?|wedding\s+breakfast|food\s+(?:and|&)\s+drink|starters?|main\s+courses?|desserts?|canap(?:e|\u00e9)s?|buffet)\b.{0,70}\b(?:packages?|rates?|prices?|from|start(?:s|ing)?|at|:)\s*(?:\u00a3|GBP)?\s*$/.test(precedingAmount) ||
    /\b(?:wedding\s+)?(?:catering|menus?|wedding\s+breakfast|starters?|main\s+courses?|desserts?|canap(?:e|\u00e9)s?|buffet)\s*(?:\u00a3|GBP)?\s*$/.test(precedingAmount);
  if (cateringPrice && explicitWedding) return { basis: "catering", unit, confidence: "high" };
  const unrelatedPrice = /\b(?:spa|golf|afternoon\s+tea|restaurant|dinner|lunch|breakfast|coffee|cake|seasonal\s+dishes|membership|ticket|admission|entry\s+fee|conference|corporate|meeting|parking|taxi|train\s+station|christmas|new\s+year)\b/.test(local);
  if (unrelatedPrice && !strongWeddingTotal) return null;

  if (unit !== "unspecified" && !explicitWedding && !strongWeddingTotal) return null;
  const directMinimumSpend = /\bminimum\s+(?:food\s+and\s+drink\s+)?spend\b.{0,45}\b(?:from|start(?:s|ing)?|at|is|of|:)\s*$/.test(labelBeforeAmount);
  if (directMinimumSpend && explicitWedding) {
    return { basis: "minimum_spend", unit: unit === "unspecified" ? "total" : unit, confidence: "high" };
  }
  const directCeremonyFee = /\b(?:(?:ceremony|civil\s+ceremony)\s+(?:room\s+)?(?:hire\s+)?fee|ceremony\s+room\s+hire)\b.{0,45}\b(?:from|start(?:s|ing)?|at|is|of|:)\s*$/.test(labelBeforeAmount) ||
    /^\s*(?:for\s+)?(?:a\s+)?(?:ceremony|civil\s+ceremony)\s+(?:room\s+)?(?:hire\s+)?fee\b/.test(followingAmount);
  if (directCeremonyFee) {
    return { basis: "ceremony_fee", unit: unit === "unspecified" ? "total" : unit, confidence: "high" };
  }
  if (directExclusiveUse) return { basis: "exclusive_use", unit: unit === "unspecified" ? "total" : unit, confidence: "high" };
  if (directNamedPackage) return { basis: "wedding_package", unit: unit === "unspecified" ? "total" : unit, confidence: "high" };
  if (directVenueHire) return { basis: "venue_hire", unit: unit === "unspecified" ? "total" : unit, confidence: "high" };
  if (directWeddingPackage) return { basis: "wedding_package", unit: unit === "unspecified" ? "total" : unit, confidence: "high" };

  const connectedWeddingPrice = /\b(?:weddings?|receptions?)\b.{0,60}\b(?:prices?|pricing|costs?|from|start(?:s|ing)?)\s*$/.test(labelBeforeAmount) ||
    /^\s*(?:per\s+(?:person|event)\s+)?(?:for\s+)?(?:a\s+)?(?:weddings?|receptions?)\b/.test(followingAmount);
  if (explicitWedding && connectedWeddingPrice) return { basis: "wedding_price", unit, confidence: "medium" };
  return null;
}

function inferPriceQualifier(context: string, amount: number): PublishedPrice["qualifier"] {
  const local = contextAroundAmount(context, amount, 80);
  const amounts = [...local.matchAll(/(?:\u00a3|GBP\s*)\s*([\d,]+(?:\.\d{2})?)/gi)]
    .map((match) => ({ amount: Number(match[1].replaceAll(",", "")), index: match.index ?? 0 }));
  if (amounts.length >= 2 && /(?:-|\u2013|\u2014|\bto\b)/i.test(local.slice(amounts[0].index, amounts.at(-1)!.index))) {
    if (amounts[0].amount === amount) return "range_low";
    if (amounts.at(-1)!.amount === amount) return "range_high";
  }
  const amountIndex = findAmountIndex(local, amount);
  const preceding = local.slice(Math.max(0, amountIndex - 55), Math.max(0, amountIndex));
  return /\b(?:from|start(?:s|ing)?(?:\s+at)?|as\s+little\s+as)\b/i.test(preceding) ? "from" : "fixed";
}

function contextAroundAmount(context: string, amount: number, radius: number) {
  const index = findAmountIndex(context, amount);
  if (index < 0) return context.slice(0, radius * 2);
  return context.slice(Math.max(0, index - radius), Math.min(context.length, index + String(amount).length + radius));
}

function findAmountIndex(context: string, amount: number) {
  const variants = [amount.toLocaleString("en-GB"), String(amount), amount.toFixed(2)];
  const lower = context.toLowerCase();
  for (const variant of variants) {
    const index = lower.indexOf(variant.toLowerCase());
    if (index >= 0) return index;
  }
  return -1;
}

function leastConfidence(left: ResearchConfidence, right: ResearchConfidence): ResearchConfidence {
  const rank: Record<ResearchConfidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[left] <= rank[right] ? left : right;
}

function publishedPriceKey(price: PublishedPrice) {
  return `${price.amount}:${price.basis}:${price.unit}`;
}

function visitJsonLd(
  value: unknown,
  inheritedContext: string,
  treatAsOffer: boolean,
  onPrice: (candidate: Omit<Parameters<typeof normalizePublishedPriceEvidence>[0], "currency" | "sourceUrl" | "extractionMethod">) => void,
  inheritedCurrency = ""
) {
  if (Array.isArray(value)) {
    for (const item of value) visitJsonLd(item, inheritedContext, treatAsOffer, onPrice, inheritedCurrency);
    return;
  }
  if (!value || typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  const types = [object["@type"]].flat().filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase());
  const ownContext = [object.name, object.description, object.category, object.serviceType]
    .filter((item): item is string => typeof item === "string")
    .join(" ");
  const context = `${inheritedContext} ${ownContext}`.replace(/\s+/g, " ").trim();
  const currency = typeof object.priceCurrency === "string" ? object.priceCurrency : inheritedCurrency;
  const isOffer = treatAsOffer || types.some((type) => /(?:^|[\/:])(?:aggregate)?offer$/.test(type));
  if (isOffer) emitJsonLdOfferPrices(object, context, onPrice, currency);

  if (object.offers) visitJsonLd(object.offers, context, true, onPrice, currency);
  if (object.priceSpecification) visitJsonLd(object.priceSpecification, context, true, onPrice, currency);
  if (object["@graph"]) visitJsonLd(object["@graph"], inheritedContext, false, onPrice, inheritedCurrency);
  for (const [key, child] of Object.entries(object)) {
    if (["offers", "priceSpecification", "@graph"].includes(key) || child == null || typeof child !== "object") continue;
    visitJsonLd(child, context, false, onPrice, currency);
  }
}

function emitJsonLdOfferPrices(
  offer: Record<string, unknown>,
  inheritedContext: string,
  onPrice: (candidate: Omit<Parameters<typeof normalizePublishedPriceEvidence>[0], "currency" | "sourceUrl" | "extractionMethod">) => void,
  inheritedCurrency: string
) {
  const currency = String(offer.priceCurrency ?? inheritedCurrency).trim();
  const evidenceFields = ["@type", "name", "description", "category", "price", "lowPrice", "highPrice", "minPrice", "maxPrice", "priceCurrency", "unitText", "unitCode", "url"];
  const rawEvidence = JSON.stringify(Object.fromEntries(evidenceFields.filter((key) => offer[key] != null).map((key) => [key, offer[key]]))).slice(0, 800);
  const unitContext = [offer.name, offer.description, offer.unitText, offer.unitCode]
    .filter((item): item is string => typeof item === "string")
    .join(" ");
  const values: Array<{ value: unknown; qualifier: PublishedPrice["qualifier"] }> = [
    { value: offer.price, qualifier: "fixed" },
    { value: offer.lowPrice, qualifier: "range_low" },
    { value: offer.highPrice, qualifier: "range_high" },
    { value: offer.minPrice, qualifier: "range_low" },
    { value: offer.maxPrice, qualifier: "range_high" }
  ];
  for (const item of values) {
    const raw = typeof item.value === "number" || typeof item.value === "string" ? String(item.value) : "";
    const amount = Number(raw.replace(/[^\d.]/g, ""));
    const itemCurrency = currency || (/\u00a3/.test(raw) ? "GBP" : "");
    if (itemCurrency.toUpperCase() !== "GBP") continue;
    const context = `${inheritedContext} ${unitContext} price: ${raw}`.replace(/\s+/g, " ").trim().slice(0, 800);
    onPrice({ amount, context, evidenceText: rawEvidence, qualifier: item.qualifier });
  }
}

export function extractEmails(html: string) {
  const decoded = decodeHtml(html.replace(/\s+at\s+/gi, "@").replace(/\s+dot\s+/gi, "."));
  const visibleText = htmlToText(decoded);
  const mailtoValues = [...decoded.matchAll(/\bhref\s*=\s*(?:"mailto:([^"?]+)(?:\?[^\"]*)?"|'mailto:([^'?]+)(?:\?[^']*)?'|mailto:([^\s>?'\"]+)(?:\?[^\s>'\"]*)?)/gi)]
    .flatMap((match) => decodeUriComponentSafely(match[1] ?? match[2] ?? match[3] ?? "").match(emailPattern) ?? []);
  const visibleValues = visibleText.match(emailPattern) ?? [];
  return [...new Set([...mailtoValues, ...visibleValues].map((value) => value.trim().toLowerCase()).filter(isEmailSyntaxValid))];
}

export function isEmailSyntaxValid(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain || /[%/\\\"]/.test(localPart) || localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) return false;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)) return false;
  return !ignoredEmailFragments.some((fragment) => email.includes(fragment)) && !/\.(?:png|jpe?g|gif|webp|svg)$/i.test(email);
}

function parseRobotsGroups(text: string) {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let current: { agents: string[]; rules: Array<{ allow: boolean; path: string }> } | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line.includes(":")) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) {
      if (value) current.rules.push({ allow: key === "allow", path: value });
    }
  }
  return groups;
}

function robotsPathMatches(rulePath: string, path: string) {
  const anchored = rulePath.endsWith("$");
  const source = rulePath.replace(/\$$/, "").split("*").map(escapeRegExp).join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`).test(path);
}

function robotsRuleSpecificity(rulePath: string) {
  return rulePath.replace(/[\*$]/g, "").length;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractOfficialPdfLinks(html: string, pageUrl: string, websiteUrl: string) {
  const links: Array<{ url: string; text: string }> = [];
  for (const match of html.matchAll(linkPattern)) {
    const href = decodeHtml(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!href || /^(?:#|mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const url = new URL(href, pageUrl);
      url.hash = "";
      const text = htmlToText(match[4] ?? "");
      if (!sameOfficialHost(url.toString(), websiteUrl) || !isPdfCandidateLink(url, text)) continue;
      if (!/\b(?:wedding|pricing|prices?|packages?|venue[-\s]+hire|exclusive[-\s]+use|catering|brochure)\b/i.test(`${url.pathname} ${url.search} ${text}`)) continue;
      links.push({ url: url.toString(), text });
    } catch {
      // Ignore malformed links published by the site.
    }
  }
  return links;
}

function extractSameHostLinks(html: string, pageUrl: string, websiteUrl: string) {
  const links: Array<{ url: string; text: string }> = [];
  for (const match of html.matchAll(linkPattern)) {
    const href = decodeHtml(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!href || /^(?:#|mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const url = new URL(href, pageUrl);
      url.hash = "";
      if (!sameOfficialHost(url.toString(), websiteUrl) || /\.(?:jpe?g|png|gif|webp|svg|mp4|mov|zip)$/i.test(url.pathname)) continue;
      if (/\.pdf$/i.test(url.pathname)) continue;
      links.push({ url: url.toString(), text: htmlToText(match[4] ?? "") });
    } catch {
      // Ignore malformed links published by the site.
    }
  }
  return links;
}

function isPdfCandidateLink(url: URL, text: string) {
  return /\.pdf$/i.test(url.pathname) || /\bpdf\b/i.test(`${url.pathname} ${url.search} ${text}`) ||
    /\bdownload\s+(?:our\s+)?(?:wedding\s+|pricing\s+)?brochure\b/i.test(text);
}

function scoreLink(link: { url: string; text: string }) {
  const value = `${link.url} ${link.text}`.toLowerCase();
  return preferredLinkTerms.reduce((score, term, index) => score + (value.includes(term) ? preferredLinkTerms.length - index : 0), 0);
}

async function discoverSitemapPageUrls(
  website: string,
  robotsText: string,
  limit: number,
  options: Required<Pick<ResearchOptions, "fetchImpl" | "lookupImpl" | "timeoutMs" | "retries" | "minimumHostDelayMs" | "userAgent">>
) {
  const explicitSitemaps = robotsText.split(/\r?\n/)
    .map((line) => line.match(/^\s*sitemap\s*:\s*(\S+)/i)?.[1])
    .filter((value): value is string => Boolean(value));
  const defaultSitemap = new URL("/sitemap.xml", website).toString();
  const pending = [...new Set([...explicitSitemaps, defaultSitemap])];
  const visited = new Set<string>();
  const pages = new Map<string, { url: string; text: string }>();
  const warnings: string[] = [];
  let requestCount = 0;
  let retryCount = 0;

  while (pending.length && visited.size < 4) {
    const sitemapUrl = pending.shift()!;
    const key = normalizedUrlKey(sitemapUrl);
    if (visited.has(key) || !sameOfficialHost(sitemapUrl, website)) continue;
    visited.add(key);
    try {
      const sitemap = await fetchWithPolicy(sitemapUrl, options);
      requestCount += sitemap.requestCount;
      retryCount += sitemap.retryCount;
      if (!sitemap.response.ok) continue;
      const locations = extractSitemapLocations(sitemap.body, sitemap.response.url || sitemapUrl);
      for (const location of locations) {
        if (!sameOfficialHost(location, website)) continue;
        const url = new URL(location);
        const locationKey = normalizedUrlKey(url.toString());
        if (/\.xml\.gz$/i.test(url.pathname)) continue;
        if (/\.xml$/i.test(url.pathname)) {
          if (!visited.has(locationKey) && pending.length < 8) pending.push(url.toString());
          continue;
        }
        if (/\.(?:pdf|jpe?g|png|gif|webp|svg|mp4|mov|zip)$/i.test(url.pathname)) continue;
        const link = { url: url.toString(), text: url.pathname.replace(/[-_/]+/g, " ") };
        if (scoreLink(link) > 0 && !pages.has(locationKey)) pages.set(locationKey, link);
      }
    } catch (error) {
      if (explicitSitemaps.some((value) => normalizedUrlKey(value) === key)) {
        warnings.push(`An advertised sitemap could not be read: ${errorMessage(error)}`);
      }
    }
  }

  const urls = [...pages.values()]
    .sort((left, right) => scoreLink(right) - scoreLink(left) || left.url.localeCompare(right.url))
    .slice(0, Math.max(0, limit))
    .map((item) => item.url);
  return { urls, requestCount, retryCount, warnings };
}

function extractSitemapLocations(xml: string, sitemapUrl: string) {
  const locations: string[] = [];
  for (const match of xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)) {
    const raw = decodeHtml(match[1]).trim();
    if (!raw) continue;
    try {
      const url = new URL(raw, sitemapUrl);
      url.hash = "";
      locations.push(url.toString());
    } catch {
      // Ignore malformed sitemap entries.
    }
  }
  return locations;
}

async function fetchWithPolicy(
  url: string,
  options: Required<Pick<ResearchOptions, "fetchImpl" | "lookupImpl" | "timeoutMs" | "retries" | "minimumHostDelayMs" | "userAgent">>
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    if (attempt) await delay(400 * 2 ** (attempt - 1));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      let currentUrl = url;
      for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
        await assertPublicNetworkTarget(currentUrl, options.lookupImpl);
        await waitForHost(currentUrl, options.minimumHostDelayMs);
        const response = await options.fetchImpl(currentUrl, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": options.userAgent,
            Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.2"
          }
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) throw new Error(`HTTP ${response.status} redirect has no Location header.`);
          if (redirectCount >= 5) throw new Error("Website exceeded the five-redirect safety limit.");
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
        const declaredLength = Number(response.headers.get("content-length") ?? "0");
        if (declaredLength > 2_000_000) throw new Error("Response exceeds the 2 MB research limit.");
        const body = (await response.text()).slice(0, 2_000_000);
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`HTTP ${response.status}`);
          break;
        }
        return { response, body, requestCount: attempt + 1, retryCount: attempt };
      }
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Website request failed.");
}

async function fetchPdfWithPolicy(
  url: string,
  website: string,
  maxBytes: number,
  options: Required<Pick<ResearchOptions, "fetchImpl" | "lookupImpl" | "timeoutMs" | "retries" | "minimumHostDelayMs" | "userAgent">>
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    if (attempt) await delay(400 * 2 ** (attempt - 1));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      let currentUrl = url;
      for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
        if (!sameOfficialHost(currentUrl, website)) throw new Error("PDF URL or redirect is outside the official website host.");
        await assertPublicNetworkTarget(currentUrl, options.lookupImpl);
        await waitForHost(currentUrl, options.minimumHostDelayMs);
        const response = await options.fetchImpl(currentUrl, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": options.userAgent,
            Accept: "application/pdf,application/octet-stream;q=0.8,*/*;q=0.1"
          }
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) throw new Error(`HTTP ${response.status} redirect has no Location header.`);
          if (redirectCount >= 5) throw new Error("PDF exceeded the five-redirect safety limit.");
          const redirectedUrl = new URL(location, currentUrl).toString();
          if (!sameOfficialHost(redirectedUrl, website)) throw new Error("PDF redirect left the official website host.");
          currentUrl = redirectedUrl;
          continue;
        }
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`HTTP ${response.status}`);
          break;
        }
        if (!response.ok) {
          return { response, data: new Uint8Array(), resolvedUrl: currentUrl, requestCount: attempt + 1, retryCount: attempt };
        }
        const declaredLength = Number(response.headers.get("content-length") ?? "0");
        if (declaredLength > maxBytes) throw new Error(`PDF exceeds the ${maxBytes} byte research limit.`);
        const data = await readResponseBytes(response, maxBytes);
        return { response, data, resolvedUrl: currentUrl, requestCount: attempt + 1, retryCount: attempt };
      }
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("PDF request failed.");
}

async function readResponseBytes(response: Response, maxBytes: number) {
  if (!response.body) {
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength > maxBytes) throw new Error(`PDF exceeds the ${maxBytes} byte research limit.`);
    return data;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("PDF exceeded the research byte limit.");
        throw new Error(`PDF exceeds the ${maxBytes} byte research limit.`);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}

function hasPdfMagicBytes(data: Uint8Array) {
  return data.byteLength >= 5 && new TextDecoder("ascii").decode(data.subarray(0, 5)) === "%PDF-";
}

async function waitForHost(url: string, minimumDelayMs: number) {
  if (!minimumDelayMs) return;
  const host = new URL(url).hostname.toLowerCase();
  const previous = hostLastRequestAt.get(host) ?? 0;
  const remaining = minimumDelayMs - (Date.now() - previous);
  if (remaining > 0) await delay(remaining);
  hostLastRequestAt.set(host, Date.now());
}

function updateBusinessStatus(result: WebsiteResearchResult, lowerText: string) {
  const definitiveClosureNotice = /\b(?:we|our business|this business|the business|our venue|this venue|the venue|our company|this company|the company)\s+(?:(?:have|has|are|is)\s+)?(?:permanently\s+closed|closed\s+permanently|ceased\s+trading|no\s+longer\s+trading)\b/.test(lowerText)
    || /\bwe\s+(?:have\s+)?closed\s+(?:our\s+)?(?:business|venue|doors)\b/.test(lowerText);
  if (definitiveClosureNotice) result.businessStatus = "closed";
  else if (/temporarily\s+closed|closed\s+for\s+(?:renovation|refurbishment|winter)/.test(lowerText) && result.businessStatus !== "closed") result.businessStatus = "temporarily_closed";
  else if (/formerly\s+known\s+as|now\s+trading\s+as|we\s+have\s+rebranded/.test(lowerText) && !["closed", "temporarily_closed"].includes(result.businessStatus)) result.businessStatus = "rebranded";
}

function classifyEmail(email: string): WebsiteResearchResult["emails"][number]["type"] {
  const local = email.split("@")[0].toLowerCase();
  if (/wedding|event/.test(local)) return "wedding";
  if (/sales/.test(local)) return "sales";
  if (/book|reservation/.test(local)) return "bookings";
  if (/owner|director/.test(local)) return "owner";
  if (/manager/.test(local)) return "manager";
  if (/reception/.test(local)) return "reception";
  return "general";
}

function compareEmailFindings(left: WebsiteResearchResult["emails"][number], right: WebsiteResearchResult["emails"][number]) {
  const order = ["wedding", "sales", "bookings", "owner", "manager", "general", "reception"];
  const verificationDifference = Number(right.verification.status === "likely_valid") - Number(left.verification.status === "likely_valid");
  if (verificationDifference) return verificationDifference;
  return order.indexOf(left.type) - order.indexOf(right.type) || left.email.localeCompare(right.email);
}

function publicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".local") || isPrivateOrReservedIp(url.hostname)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function sameOfficialHost(candidate: string, website: string) {
  const candidateUrl = publicHttpUrl(candidate);
  const websiteUrl = publicHttpUrl(website);
  if (!candidateUrl || !websiteUrl) return false;
  const candidateHost = normalizedHost(new URL(candidateUrl).hostname);
  const websiteHost = normalizedHost(new URL(websiteUrl).hostname);
  return candidateHost === websiteHost || candidateHost.endsWith(`.${websiteHost}`);
}

export function emailDomainMatchesOfficialWebsite(emailDomain: string, website: string) {
  const websiteUrl = publicHttpUrl(website);
  if (!websiteUrl) return false;
  const emailHost = normalizedHost(emailDomain);
  const websiteHost = normalizedHost(new URL(websiteUrl).hostname);
  return emailHost === websiteHost || emailHost.endsWith(`.${websiteHost}`);
}

export function isPromotablePublicBusinessEmail(finding: WebsiteEmailFinding, officialWebsiteUrl: string) {
  const emailDomain = normalizeEmailDomain(finding.email);
  return isEmailSyntaxValid(finding.email) &&
    finding.verification.status === "likely_valid" &&
    finding.verification.domainAssociated === true &&
    Boolean(emailDomain) &&
    emailDomainMatchesOfficialWebsite(emailDomain, officialWebsiteUrl) &&
    sameOfficialHost(finding.sourceUrl, officialWebsiteUrl);
}

export function normalizeCachedEmailFinding(finding: WebsiteEmailFinding, officialWebsiteUrl: string): WebsiteEmailFinding {
  const syntaxValid = isEmailSyntaxValid(finding.email);
  const emailDomain = normalizeEmailDomain(finding.email);
  const domainAssociated = Boolean(emailDomain && emailDomainMatchesOfficialWebsite(emailDomain, officialWebsiteUrl));
  const officialSource = sameOfficialHost(finding.sourceUrl, officialWebsiteUrl);
  const terminalStatus = ["invalid", "hard_bounce", "suppressed", "opted_out"].includes(finding.verification.status);
  let status = finding.verification.status;
  if (!terminalStatus) {
    if (!syntaxValid || finding.verification.domainExists === false || finding.verification.disposable) status = "invalid";
    else if (finding.verification.mxValid === true && domainAssociated && officialSource) status = "likely_valid";
    else status = "unverified";
  }

  const notes = finding.verification.notes.filter((note) =>
    !/email domain (?:differs|is not)|ownership evidence|official-domain|official website domain/i.test(note)
  );
  if (!domainAssociated) notes.push("The cached email domain is not the current official website domain or one of its subdomains.");
  if (!officialSource) notes.push("The cached source URL is not on the current official website domain or one of its subdomains.");

  return {
    ...finding,
    confidence: status === "likely_valid" ? "high" : status === "invalid" ? "low" : "medium",
    verification: {
      ...finding.verification,
      syntaxValid,
      domainAssociated,
      status,
      method: "syntax+dns_mx+official_domain_association_rechecked",
      notes: [...new Set(notes)]
    }
  };
}

function normalizedHost(value: string) {
  return value.toLowerCase().replace(/^www\./, "").replace(/^\[|\]$/g, "");
}

function normalizeEmailDomain(value: string) {
  const email = value.trim().toLowerCase();
  return isEmailSyntaxValid(email) ? email.split("@")[1] : "";
}

function decodeUriComponentSafely(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function assertPublicNetworkTarget(value: string, lookupImpl: typeof lookup) {
  const url = publicHttpUrl(value);
  if (!url) throw new Error("Website URL is not a permitted public HTTP(S) target.");
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (isPrivateOrReservedIp(hostname)) throw new Error("Website resolves to a private or reserved network address.");
  const addresses = await withTimeout(lookupImpl(hostname, { all: true, verbatim: true }), 5_000);
  if (!addresses.length || addresses.some((item) => isPrivateOrReservedIp(item.address))) {
    throw new Error("Website resolves to a private or reserved network address.");
  }
}

export function isPrivateOrReservedIp(value: string): boolean {
  const address = normalizedHost(value);
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && ((b === 0 && (c === 0 || c === 2)) || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113);
  }
  if (family === 6) {
    const compact = address.toLowerCase();
    if (compact === "::" || compact === "::1" || compact.startsWith("fc") || compact.startsWith("fd") || compact.startsWith("ff") || /^fe[89ab]/.test(compact) || compact.startsWith("2001:db8:")) return true;
    const mapped = compact.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isPrivateOrReservedIp(mapped) : false;
  }
  return false;
}

function normalizedUrlKey(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

function htmlToText(value: string) {
  return decodeHtml(value.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
}

function dnsErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timeout = setTimeout(() => reject(new Error("DNS lookup timed out.")), timeoutMs); })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
}
