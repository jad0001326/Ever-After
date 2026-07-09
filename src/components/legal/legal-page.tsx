import type { ReactNode } from "react";

export function LegalPage({ children, intro, title, updated }: { children: ReactNode; intro: string; title: string; updated: string }) {
  return <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20"><p className="text-sm font-semibold tracking-[0.16em] text-[#95502b]">EverAft</p><h1 className="mt-4 font-display text-6xl font-semibold tracking-[-0.05em] sm:text-7xl">{title}</h1><p className="mt-6 text-lg leading-8 text-[var(--muted)]">{intro}</p><p className="mt-5 text-sm text-[#7e766b]">Last updated: {updated}</p><div className="mt-12 grid gap-9 text-base leading-7 text-[#4b4740]">{children}</div></article>;
}

export function LegalSection({ children, title }: { children: ReactNode; title: string }) {
  return <section><h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-[var(--ink)]">{title}</h2><div className="mt-3">{children}</div></section>;
}
