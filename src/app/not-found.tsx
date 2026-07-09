import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto grid min-h-[60svh] max-w-2xl place-items-center px-4 py-16 text-center sm:px-6">
      <div>
        <p className="text-sm font-semibold tracking-[0.16em] text-[#95502b]">404</p>
        <h1 className="mt-4 font-display text-6xl font-semibold tracking-[-0.05em] sm:text-7xl">This page has wandered off.</h1>
        <p className="mt-5 text-base leading-7 text-[var(--muted)]">Try the wedding venue collection, or come back to the EverAft home page.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-white transition hover:bg-[#183522]" href="/venues">Explore venues</Link>
          <Link className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] bg-white px-5 text-sm font-semibold text-[#28241f] transition hover:bg-[#f7f3eb]" href="/">Back home</Link>
        </div>
      </div>
    </section>
  );
}
