import type { Metadata } from "next";
import Link from "next/link";
import { FollowEverAft } from "@/components/social/follow-everaft";

export const metadata: Metadata = {
  title: "About EverAft",
  description: "EverAft helps couples find thoughtful wedding suppliers and helps independent businesses be discovered across the UK.",
  alternates: { canonical: "/about" }
};

export default function AboutPage() {
  return (
    <div>
      <section className="border-b border-[var(--line)] bg-[#f2ede4]">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-sm font-semibold tracking-[0.16em] text-[#95502b]">About EverAft</p>
          <h1 className="mt-4 max-w-4xl font-display text-6xl font-semibold leading-[0.88] tracking-[-0.05em] sm:text-7xl">Wedding planning deserves better than an endless list.</h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[var(--muted)]">EverAft is building a calmer way for couples to discover the people behind a brilliant wedding, and for independent businesses to be seen for the work they do best.</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
        <div>
          <h2 className="font-display text-4xl font-semibold tracking-[-0.04em]">For couples</h2>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">Clear listing information, useful search and a direct path to the businesses you want to speak with. Less noise, more momentum.</p>
          <Link className="mt-6 inline-flex text-sm font-semibold text-[var(--brand)] underline underline-offset-4" href="/venues">Explore the venue collection</Link>
        </div>
        <div>
          <h2 className="font-display text-4xl font-semibold tracking-[-0.04em]">For businesses</h2>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">An affordable, considered presence built around good information and genuine enquiries — not an opaque marketplace.</p>
          <Link className="mt-6 inline-flex text-sm font-semibold text-[var(--brand)] underline underline-offset-4" href="/for-business">Apply to join EverAft</Link>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <FollowEverAft />
      </div>
    </div>
  );
}
