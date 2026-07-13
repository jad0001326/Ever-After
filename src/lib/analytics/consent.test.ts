import { describe, expect, it, vi } from "vitest";
import {
  clearGoogleAnalyticsCookies,
  cookiePreferenceStorageKey,
  denyGoogleAnalyticsConsent,
  getCookiePreference,
  setCookiePreference,
  subscribeToCookiePreference
} from "./consent";

describe("analytics consent", () => {
  it("stores a valid preference and notifies subscribers in the same window", () => {
    window.localStorage.clear();
    const subscriber = vi.fn();
    const unsubscribe = subscribeToCookiePreference(subscriber);

    setCookiePreference("all");

    expect(window.localStorage.getItem(cookiePreferenceStorageKey)).toBe("all");
    expect(getCookiePreference()).toBe("all");
    expect(subscriber).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("ignores obsolete or malformed preference values", () => {
    window.localStorage.setItem(cookiePreferenceStorageKey, "accepted-before-analytics-existed");
    expect(getCookiePreference()).toBeNull();
  });

  it("denies Google consent and removes Google Analytics cookies on withdrawal", () => {
    const gtag = vi.fn();
    (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag = gtag;
    document.cookie = "_ga=test-value; Path=/";
    document.cookie = "_ga_TEST=stream-value; Path=/";
    document.cookie = "everaft-essential=keep; Path=/";

    denyGoogleAnalyticsConsent();
    clearGoogleAnalyticsCookies();

    expect(gtag).toHaveBeenCalledWith("consent", "update", expect.objectContaining({ analytics_storage: "denied" }));
    expect(document.cookie).not.toContain("_ga=");
    expect(document.cookie).not.toContain("_ga_TEST=");
    expect(document.cookie).toContain("everaft-essential=keep");
    delete (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
  });
});
