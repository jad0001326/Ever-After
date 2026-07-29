const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const topLevelDomainPattern = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmailSyntax(email: string) {
  if (email.length > 254 || !emailPattern.test(email)) return false;
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain || localPart.length > 64 || domain.length > 253) return false;
  if (/[%/\\\"]/.test(localPart) || localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) return false;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)) return false;
  const topLevelDomain = domain.split(".").at(-1);
  return Boolean(topLevelDomain && topLevelDomainPattern.test(topLevelDomain));
}

export function isValidOutreachEmail(email: string) {
  if (!isValidEmailSyntax(email)) return false;
  const [localPart, domain] = email.split("@");
  const normalizedLocalPart = localPart.replace(/[+._-].*$/, "");
  const placeholderLocalParts = new Set(["test", "testing", "sample", "example", "xxx", "dummy", "fake"]);
  const placeholderDomains = new Set(["example.com", "test.com", "invalid"]);
  return !placeholderLocalParts.has(normalizedLocalPart) && !placeholderDomains.has(domain);
}

export function validPublicUrl(value: string | null | undefined) {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".local")) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function hasOfficialContactSource(sourceValue: string | null | undefined, websiteValue: string | null | undefined) {
  const sourceUrl = validPublicUrl(sourceValue);
  const websiteUrl = validPublicUrl(websiteValue);
  if (!sourceUrl || !websiteUrl) return false;
  const sourceHost = normalizedHostname(sourceUrl);
  const websiteHost = normalizedHostname(websiteUrl);
  return sourceHost === websiteHost || sourceHost.endsWith(`.${websiteHost}`) || websiteHost.endsWith(`.${sourceHost}`);
}

export function isTrustedVenueContact(
  email: string,
  sourceValue: string | null | undefined,
  venue: { official_website_url: string | null | undefined }
) {
  return isValidOutreachEmail(email) && hasOfficialContactSource(sourceValue, venue.official_website_url);
}

function normalizedHostname(value: string) {
  return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
}
