import { sanitizeIntendedDestination } from "./intended-destination";

export type AuthCallback = Readonly<{
  code: string;
  nextPath: string | null;
}>;

const allowedWebHost = "www.everaft.co.uk";
const callbackPath = "/auth/callback";

export function parseAuthCallback(rawUrl: string): AuthCallback | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const isNative = url.protocol === "myeveraft:" && url.hostname === "auth";
  const isWeb = url.protocol === "https:" && url.hostname === allowedWebHost;
  const pathMatches = isNative
    ? url.pathname === "/callback"
    : isWeb && url.pathname === callbackPath;
  if (!pathMatches || url.username || url.password || url.port) return null;

  const code = url.searchParams.get("code");
  if (!code || code.length > 2048 || !/^[A-Za-z0-9._~-]+$/.test(code)) return null;

  const next = url.searchParams.get("next");
  const nextPath = next ? sanitizeIntendedDestination(next) : null;
  return { code, nextPath };
}
