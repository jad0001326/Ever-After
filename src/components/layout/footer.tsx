import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function Footer() {
  return (
    <footer className="bg-[#152017] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.25fr_1fr_1fr_1fr] lg:px-8 lg:py-16">
        <div>
          <Logo href="/" variant="full" wordmarkClassName="text-[2.55rem] !text-white" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
            A growing wedding directory for couples planning celebrations across the UK.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-[#d19a72]">Explore</p>
          <div className="mt-4 grid gap-3 text-sm text-white/75">
            <Link className="transition hover:text-white" href="/venues">Wedding venues</Link>
            <Link className="transition hover:text-white" href="/wedding-budget-planner">Wedding budget planner</Link>
            <Link className="transition hover:text-white" href="/venues?type=Castle">Castles</Link>
            <Link className="transition hover:text-white" href="/venues?type=Country+Estate">Country estates</Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-[#d19a72]">For businesses</p>
          <div className="mt-4 grid gap-3 text-sm text-white/75">
            <Link className="transition hover:text-white" href="/for-business">Join EverAft</Link>
            <Link className="transition hover:text-white" href="/supplier-terms">Supplier terms</Link>
            <Link className="transition hover:text-white" href="/vendor">Venue dashboard</Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-[#d19a72]">Company</p>
          <div className="mt-4 grid gap-3 text-sm text-white/75">
            <Link className="transition hover:text-white" href="/about">About</Link>
            <Link className="transition hover:text-white" href="/contact">Contact</Link>
            <Link className="transition hover:text-white" href="/privacy">Privacy</Link>
            <Link className="transition hover:text-white" href="/terms">Terms</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/15 px-4 py-5 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} EverAft. All rights reserved.</p>
        <p>Built for considered UK wedding planning.</p>
      </div>
    </footer>
  );
}
