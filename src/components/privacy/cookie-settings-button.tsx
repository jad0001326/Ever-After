"use client";

import { openCookiePreferences } from "@/lib/analytics/consent";

export function CookieSettingsButton() {
  return (
    <button className="text-left transition hover:text-white" onClick={openCookiePreferences} type="button">
      Cookie settings
    </button>
  );
}
