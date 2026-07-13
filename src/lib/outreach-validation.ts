const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidOutreachEmail(email: string) {
  if (!emailPattern.test(email)) return false;
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain || /[%/\\\"]/.test(localPart) || localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) return false;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)) return false;
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
