"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const storageKey = "everaft-cookie-preference-v1";

export function CookieBanner() {
  const storedPreference = useSyncExternalStore(
    () => () => undefined,
    () => window.localStorage.getItem(storageKey),
    () => null
  );
  const [dismissed, setDismissed] = useState(false);

  function choose(preference: "essential" | "all") {
    window.localStorage.setItem(storageKey, preference);
    setDismissed(true);
  }

  if (storedPreference || dismissed) return null;

  return (
    <aside aria-label="Cookie preferences" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[0_24px_70px_rgba(25,23,19,0.17)] sm:flex sm:items-end sm:gap-6">
      <div className="flex-1">
        <p className="font-semibold text-[var(--ink)]">Your cookie choices</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">We use essential cookies for sign-in and security. Optional analytics are not active yet. Read our <Link className="font-semibold text-[var(--brand)] underline underline-offset-2" href="/privacy">Privacy Notice</Link>.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 sm:mt-0 sm:shrink-0">
        <button className="focus-ring min-h-10 rounded-full border border-[var(--line)] px-4 text-sm font-semibold text-[#423e37] transition hover:bg-[#f7f3eb]" onClick={() => choose("essential")} type="button">Essential only</button>
        <button className="focus-ring min-h-10 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white transition hover:bg-[#183522]" onClick={() => choose("all")} type="button">Accept all</button>
      </div>
    </aside>
  );
}
