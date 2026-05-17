import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] bg-[#f6f1e8]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr] lg:px-8">
        <div>
          <Logo href="/" variant="full" wordmarkClassName="text-[2.35rem]" />
          <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
            Premium wedding venue discovery for couples planning a celebration in Scotland.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7a6d59]">Explore</p>
          <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
            <Link href="/venues">Search venues</Link>
            <Link href="/venues?type=Castle">Castles</Link>
            <Link href="/venues?type=Country+Estate">Country estates</Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7a6d59]">Platform</p>
          <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
            <Link href="/login">Couple login</Link>
            <Link href="/admin">Venue admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
