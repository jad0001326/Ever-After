"use client";

import { GoogleAnalytics, sendGAEvent } from "@next/third-parties/google";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { getCookiePreference, subscribeToCookiePreference } from "@/lib/analytics/consent";

type AnalyticsEventDetail = {
  name: string;
  properties?: Record<string, string | number | boolean>;
};

const measurementIdPattern = /^G-[A-Z0-9]+$/i;
const excludedPathPrefixes = ["/admin", "/vendor", "/oauth", "/outreach/unsubscribe"];

export function GoogleAnalyticsController({ measurementId }: { measurementId?: string }) {
  const preference = useSyncExternalStore(subscribeToCookiePreference, getCookiePreference, () => null);
  const pathname = usePathname();
  const gaId = measurementId?.trim() ?? "";
  const enabled = preference === "all" && measurementIdPattern.test(gaId) && !isExcludedAnalyticsPath(pathname);

  useEffect(() => {
    if (!enabled) return;

    function handleAnalyticsEvent(event: Event) {
      const detail = (event as CustomEvent<AnalyticsEventDetail>).detail;
      if (!detail?.name) return;
      sendGAEvent("event", detail.name, detail.properties ?? {});
    }

    window.addEventListener("everaft:analytics", handleAnalyticsEvent);
    return () => window.removeEventListener("everaft:analytics", handleAnalyticsEvent);
  }, [enabled]);

  return enabled ? <GoogleAnalytics gaId={gaId} /> : null;
}

export function isExcludedAnalyticsPath(pathname: string) {
  return excludedPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
