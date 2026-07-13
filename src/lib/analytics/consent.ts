export type CookiePreference = "essential" | "all";

export const cookiePreferenceStorageKey = "everaft-cookie-preference-v2";
export const cookiePreferenceChangedEvent = "everaft:cookie-preference-changed";
export const openCookiePreferencesEvent = "everaft:open-cookie-preferences";

const analyticsCookiePattern = /^_(?:ga(?:_|$)|gid$|gat(?:_|$))/;

export function getCookiePreference(): CookiePreference | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(cookiePreferenceStorageKey);
    return value === "essential" || value === "all" ? value : null;
  } catch {
    return null;
  }
}

export function setCookiePreference(preference: CookiePreference) {
  window.localStorage.setItem(cookiePreferenceStorageKey, preference);
  window.dispatchEvent(new Event(cookiePreferenceChangedEvent));
}

export function subscribeToCookiePreference(callback: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === cookiePreferenceStorageKey) callback();
  }

  window.addEventListener(cookiePreferenceChangedEvent, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(cookiePreferenceChangedEvent, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

export function openCookiePreferences() {
  window.dispatchEvent(new Event(openCookiePreferencesEvent));
}

export function denyGoogleAnalyticsConsent() {
  const analyticsWindow = window as typeof window & { gtag?: (...args: unknown[]) => void };
  analyticsWindow.gtag?.("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied"
  });
}

export function clearGoogleAnalyticsCookies() {
  const names = document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter((name): name is string => Boolean(name) && analyticsCookiePattern.test(name));
  const hostname = window.location.hostname;
  const baseHostname = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  const domains = Array.from(new Set(["", hostname, `.${hostname}`, baseHostname, `.${baseHostname}`]));

  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}
