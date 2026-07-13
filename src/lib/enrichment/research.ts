import { lookup, resolve4, resolve6, resolveMx } from "node:dns/promises";
import { isIP } from "node:net";

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
};

export type PublishedPrice = {
  amount: number;
  currency: "GBP";
  context: string;
  sourceUrl: string;
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
  "contact", "enquir", "wedding", "events", "book", "pricing", "prices", "packages", "brochure", "faq",
  "terms", "privacy"
];

const hostLastRequestAt = new Map<string, number>();

export async function researchOfficialWebsite(target: ResearchTarget, options: ResearchOptions = {}): Promise<WebsiteResearchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookupImpl = options.lookupImpl ?? lookup;
  const maxPages = clamp(options.maxPages ?? 5, 1, 10);
  const timeoutMs = clamp(options.timeoutMs ?? 10_000, 1_000, 30_000);
  const retries = clamp(options.retries ?? 2, 0, 4);
  const minimumHostDelayMs = clamp(options.minimumHostDelayMs ?? 750, 0, 10_000);
  const userAgent = options.userAgent ?? "EverAftDataQualityAudit/1.0 (+https://www.everaft.co.uk)";
  const checkedAt = new Date().toISOString();
  const result: WebsiteResearchResult = {
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

  const queue = [website];
  const queued = new Set(queue.map(normalizedUrlKey));
  const emailEvidence = new Map<string, { email: string; sourceUrl: string }>();
  const priceEvidence = new Map<string, PublishedPrice>();
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
      for (const price of extractPublishedPrices(visibleText, resolvedUrl)) {
        priceEvidence.set(`${price.amount}:${price.context}:${price.sourceUrl}`, price);
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
  const findings: PublishedPrice[] = [];
  const amountPattern = "((?:[1-9]\\d{0,2}(?:,\\d{3})+|[1-9]\\d{1,5})(?:\\.\\d{2})?)";
  const pattern = new RegExp(
    `(?:\\u00a3\\s*${amountPattern}|(?:prices?|pricing|packages?|venue\\s+hire|hire\\s+fee|starting\\s+price)\\s+(?:start(?:ing)?\\s+)?(?:from|at|of|is|:)\\s*(?:\\u00a3\\s*)?${amountPattern})`,
    "gi"
  );
  for (const match of compact.matchAll(pattern)) {
    const rawAmount = match[1] ?? match[2];
    const amount = Number(rawAmount.replaceAll(",", ""));
    if (!Number.isFinite(amount) || amount < 20 || amount > 500_000) continue;
    const followingText = compact.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 30);
    if (/^\s*(?:guests?|people|persons?|attendees|delegates|rooms?)\b/i.test(followingText)) continue;
    const start = Math.max(0, (match.index ?? 0) - 90);
    const end = Math.min(compact.length, (match.index ?? 0) + match[0].length + 120);
    const context = compact.slice(start, end).trim();
    if (/\b(?:deposit|booking\s+fee|save|discount|voucher|gift\s+card)\b/i.test(context)) continue;
    if (!/wedding|ceremony|reception|venue|hire|package|event|guest|person|room|day/i.test(context)) continue;
    findings.push({ amount, currency: "GBP", context: context.slice(0, 300), sourceUrl });
  }
  return findings;
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

function extractSameHostLinks(html: string, pageUrl: string, websiteUrl: string) {
  const links: Array<{ url: string; text: string }> = [];
  for (const match of html.matchAll(linkPattern)) {
    const href = decodeHtml(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!href || /^(?:#|mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const url = new URL(href, pageUrl);
      url.hash = "";
      if (!sameOfficialHost(url.toString(), websiteUrl) || /\.(?:jpe?g|png|gif|webp|svg|mp4|mov|zip)$/i.test(url.pathname)) continue;
      links.push({ url: url.toString(), text: htmlToText(match[4] ?? "") });
    } catch {
      // Ignore malformed links published by the site.
    }
  }
  return links;
}

function scoreLink(link: { url: string; text: string }) {
  const value = `${link.url} ${link.text}`.toLowerCase();
  return preferredLinkTerms.reduce((score, term, index) => score + (value.includes(term) ? preferredLinkTerms.length - index : 0), 0);
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

async function waitForHost(url: string, minimumDelayMs: number) {
  if (!minimumDelayMs) return;
  const host = new URL(url).hostname.toLowerCase();
  const previous = hostLastRequestAt.get(host) ?? 0;
  const remaining = minimumDelayMs - (Date.now() - previous);
  if (remaining > 0) await delay(remaining);
  hostLastRequestAt.set(host, Date.now());
}

function updateBusinessStatus(result: WebsiteResearchResult, lowerText: string) {
  if (/permanently\s+closed|we\s+(?:have\s+)?closed|ceased\s+trading|no\s+longer\s+trading/.test(lowerText)) result.businessStatus = "closed";
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
